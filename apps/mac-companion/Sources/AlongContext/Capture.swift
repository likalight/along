import AppKit
import ApplicationServices

@MainActor
final class ActivityCapture {
    var allowedApps = Set<String>()
    var allApps = false
    var excludedApps = Set<String>()
    var includeText = false
    private(set) var running = false
    var onActivity: ((Activity) -> Void)?
    var onStatus: ((String) -> Void)?
    private var monitor: Any?
    private var observations: [NSObjectProtocol] = []
    private var timer: Timer?
    private var counts: [String: Int] = [:]
    private var currentApp: NSRunningApplication?
    private var lastText = ""
    private var lastRead = Date.distantPast

    func start() -> Bool {
        guard !running else { return true }
        guard AXIsProcessTrusted() else {
            onStatus?("Accessibility permission is required. Grant it in System Settings, then start again.")
            return false
        }
        guard allApps || !allowedApps.isEmpty else {
            onStatus?("Select at least one app before starting.")
            return false
        }
        running = true
        currentApp = NSWorkspace.shared.frontmostApplication
        let center = NSWorkspace.shared.notificationCenter
        observations.append(center.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.running else { return }
                self.flush()
                self.currentApp = NSWorkspace.shared.frontmostApplication
                self.lastText = ""
                self.lastRead = .distantPast
                self.record("app activated")
            }
        })
        for name in [NSWorkspace.willSleepNotification, NSWorkspace.sessionDidResignActiveNotification, NSWorkspace.screensDidSleepNotification] {
            observations.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    self?.stop()
                    self?.onStatus?("Paused for sleep or session lock. Resume manually when ready.")
                }
            })
        }
        monitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown, .keyDown, .scrollWheel]) { [weak self] event in
            MainActor.assumeIsolated {
                // Never access characters, keyCode, clipboard, or event coordinates.
                let kind = event.type == .keyDown ? "keyboard activity" : event.type == .scrollWheel ? "scroll activity" : "click"
                self?.record(kind)
            }
        }
        guard monitor != nil else {
            stop()
            onStatus?("macOS could not start the event monitor. Check Accessibility permissions.")
            return false
        }
        timer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                guard AXIsProcessTrusted() else {
                    self.stop()
                    self.onStatus?("Paused: Accessibility permission was revoked.")
                    return
                }
                self.flush()
            }
        }
        record("app activated")
        onStatus?("Recording on this Mac. Pause whenever you want.")
        return true
    }

    func stop() {
        // Do not flush buffered context after the user pauses or changes permissions.
        running = false
        counts.removeAll()
        currentApp = nil
        lastText = ""
        timer?.invalidate()
        timer = nil
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
        for observer in observations { NSWorkspace.shared.notificationCenter.removeObserver(observer) }
        observations.removeAll()
    }

    private func record(_ kind: String) {
        guard running, let app = NSWorkspace.shared.frontmostApplication,
              let id = app.bundleIdentifier, isAllowed(id),
              !CapturePolicy.blockedApps.contains(id) else { return }
        if app.processIdentifier != currentApp?.processIdentifier {
            // Discard a stale batch rather than attributing it to a different app.
            counts.removeAll()
            currentApp = app
            lastText = ""
        }
        counts[kind, default: 0] += 1
    }

    private func flush() {
        guard running, !counts.isEmpty, let app = currentApp,
              let id = app.bundleIdentifier, isAllowed(id),
              !CapturePolicy.blockedApps.contains(id) else { counts.removeAll(); return }
        var title = ""
        var excerpt = ""
        // Never inspect background windows or browser content. Private mode cannot
        // reliably be inferred from a title; unknown sources therefore fail closed.
        if includeText, CapturePolicy.textApps.contains(id),
           NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier,
           Date().timeIntervalSince(lastRead) >= 6 {
            lastRead = Date()
            (title, excerpt) = readContext(app)
            let fingerprint = title + "\n" + excerpt
            if fingerprint == lastText { title = ""; excerpt = "" }
            else { lastText = fingerprint }
        }
        let snapshot = counts
        counts.removeAll()
        onActivity?(Activity(app: app.localizedName ?? "Application", bundleID: id,
                             kind: snapshot.keys.sorted().joined(separator: ", "), count: snapshot.values.reduce(0, +),
                             title: title, excerpt: excerpt))
    }

    func isAllowed(_ id: String) -> Bool {
        !CapturePolicy.blockedApps.contains(id) && (allApps ? !excludedApps.contains(id) : allowedApps.contains(id))
    }

    private func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
        var result: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &result) == .success else { return nil }
        return result
    }

    private func element(_ source: AXUIElement, _ name: String) -> AXUIElement? {
        guard let value = attribute(source, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return (value as! AXUIElement)
    }

    private func readContext(_ app: NSRunningApplication) -> (String, String) {
        let root = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(root, 0.08)
        guard let focus = element(root, kAXFocusedUIElementAttribute) else { return ("", "") }
        // Secure or ordinary form fields are never read, including ancestor checks.
        var ancestor: AXUIElement? = focus
        for _ in 0..<8 {
            guard let item = ancestor else { break }
            let subrole = attribute(item, kAXSubroleAttribute) as? String ?? ""
            let role = attribute(item, kAXRoleAttribute) as? String ?? ""
            if subrole == kAXSecureTextFieldSubrole || role == kAXTextFieldRole { return ("", "") }
            ancestor = element(item, kAXParentAttribute)
        }
        let window = element(root, kAXFocusedWindowAttribute)
        let title = window.flatMap { attribute($0, kAXTitleAttribute) as? String } ?? ""
        var chunks: [String] = []
        var queue: [(AXUIElement, Int)] = [(focus, 0)]
        var visits = 0
        let deadline = Date().addingTimeInterval(0.15)
        while !queue.isEmpty && visits < 32 && Date() < deadline && chunks.joined().count < 1200 {
            let (item, depth) = queue.removeFirst()
            visits += 1
            let role = attribute(item, kAXRoleAttribute) as? String ?? ""
            let subrole = attribute(item, kAXSubroleAttribute) as? String ?? ""
            if role == kAXTextFieldRole || subrole == kAXSecureTextFieldSubrole { continue }
            if role == kAXStaticTextRole || (app.bundleIdentifier == "com.apple.TextEdit" && role == kAXTextAreaRole) {
                if let value = attribute(item, kAXValueAttribute) as? String, !value.isEmpty { chunks.append(value) }
            }
            if depth < 4, let children = attribute(item, kAXChildrenAttribute) as? [AXUIElement] {
                queue.append(contentsOf: children.prefix(16).map { ($0, depth + 1) })
            }
        }
        return (CapturePolicy.redact(title, limit: 180), CapturePolicy.redact(chunks.joined(separator: "\n")))
    }
}
