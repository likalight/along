import AppKit
@preconcurrency import ApplicationServices
import UniformTypeIdentifiers

@MainActor
final class CompanionDelegate: NSObject, NSApplicationDelegate, NSTableViewDataSource, NSTableViewDelegate {
    private var window: NSWindow!
    private var homeWindow: NSWindow!
    private let allowButton = NSButton(title: "Allow", target: nil, action: nil)
    private let homeStatus = NSTextField(wrappingLabelWithString: "Nothing is recorded until you allow it.")
    private var pendingAllow = false
    private var statusItem: NSStatusItem!
    private var history: LocalHistory!
    private var retentionTimer: Timer?
    private let capture = ActivityCapture()
    private let status = NSTextField(wrappingLabelWithString: "Paused. Nothing is being recorded.")
    private let detail = NSTextView()
    private let table = NSTableView()
    private let appStack = NSStackView()
    private let startButton = NSButton(title: "Start recording", target: nil, action: nil)
    private let textToggle = NSButton(checkboxWithTitle: "Include supported native-app text (may contain personal information)", target: nil, action: nil)
    private let keyMenu = NSPopUpButton()
    private let valueMenu = NSPopUpButton()
    private let memoryLabel = NSTextField(wrappingLabelWithString: "No reviewed preferences yet.")

    func applicationDidFinishLaunching(_ notification: Notification) {
        do { history = try LocalHistory() }
        catch {
            let alert = NSAlert()
            alert.messageText = "Along could not open its local history"
            alert.informativeText = "No capture was started. Check Application Support/AlongContext permissions or move damaged files aside."
            alert.runModal()
            NSApp.terminate(nil)
            return
        }
        capture.allowedApps = Set(UserDefaults.standard.stringArray(forKey: "allowedApps") ?? [])
        capture.allApps = UserDefaults.standard.bool(forKey: "allApps")
        capture.excludedApps = Set(UserDefaults.standard.stringArray(forKey: "excludedApps") ?? [])
        capture.includeText = UserDefaults.standard.bool(forKey: "includeText")
        capture.onActivity = { [weak self] activity in
            guard let self else { return }
            do { try self.history.append(activity); self.table.reloadData() }
            catch { self.capture.stop(); self.setStatus("Paused: unable to save local history.") }
        }
        capture.onStatus = { [weak self] in self?.setStatus($0) }
        buildWindow()
        buildHome()
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "Along ○"
        let menu = NSMenu()
        menu.addItem(withTitle: "Along", action: #selector(show), keyEquivalent: "")
        menu.addItem(withTitle: "Settings & history…", action: #selector(showSettings), keyEquivalent: "")
        menu.addItem(withTitle: "Pause recording", action: #selector(pause), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "Quit Along Context", action: #selector(quit), keyEquivalent: "q")
        for item in menu.items { item.target = self }
        statusItem.menu = menu
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Settings & history…", action: #selector(showSettings), keyEquivalent: ",").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Along Context", action: #selector(quit), keyEquivalent: "q").target = self
        appItem.submenu = appMenu
        NSApp.mainMenu = mainMenu
        refreshApps()
        refreshMemories()
        retentionTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                let count = self.history.activities.count
                do {
                    try self.history.prune()
                    if self.history.activities.count != count {
                        self.table.deselectAll(nil)
                        self.table.reloadData()
                        self.detail.string = "Expired activity was removed. Select an activity to review."
                    }
                    self.refreshMemories()
                } catch {
                    self.capture.stop()
                    self.setStatus("Paused: unable to enforce local retention. Check local file permissions.")
                }
            }
        }
        show()
    }

    func applicationWillTerminate(_ notification: Notification) { capture.stop(); retentionTimer?.invalidate() }
    func applicationDidBecomeActive(_ notification: Notification) {
        if pendingAllow && AXIsProcessTrusted() { pendingAllow = false; beginAllowedCapture() }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { show(); return true }

    private func button(_ title: String, _ action: Selector) -> NSButton {
        NSButton(title: title, target: self, action: action)
    }
    private func label(_ text: String, size: CGFloat = 13) -> NSTextField {
        let view = NSTextField(wrappingLabelWithString: text)
        view.font = .systemFont(ofSize: size)
        return view
    }
    private func stack(_ views: [NSView], vertical: Bool = false) -> NSStackView {
        let result = NSStackView(views: views)
        result.orientation = vertical ? .vertical : .horizontal
        result.alignment = .leading
        result.spacing = 10
        return result
    }
    private func buildWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Along · Settings & history"
        window.minSize = NSSize(width: 900, height: 780)
        window.center()
        let root = stack([], vertical: true)
        root.translatesAutoresizingMaskIntoConstraints = false
        window.contentView?.addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 24),
            root.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -24),
            root.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 22),
            root.bottomAnchor.constraint(equalTo: window.contentView!.bottomAnchor, constant: -20)
        ])
        root.addArrangedSubview(label("Your context. Under your control.", size: 27))
        root.addArrangedSubview(label("Records activity only in selected apps. Counts interactions, never raw keystrokes. No screenshots, microphone, clipboard or automatic uploads. Browser text and titles are excluded in this version. This is an Along prototype, not ChatGPT Computer History."))
        status.textColor = .secondaryLabelColor
        root.addArrangedSubview(status)
        startButton.target = self; startButton.action = #selector(toggle)
        root.addArrangedSubview(stack([startButton, button("Grant Accessibility…", #selector(permission)), button("Refresh app list", #selector(refreshApps)), button("Open local files", #selector(reveal))]))
        appStack.orientation = .vertical; appStack.alignment = .leading; appStack.spacing = 4
        let appScroll = NSScrollView()
        appScroll.hasVerticalScroller = true
        appScroll.documentView = appStack
        appStack.translatesAutoresizingMaskIntoConstraints = false
        appStack.widthAnchor.constraint(equalTo: appScroll.widthAnchor, constant: -20).isActive = true
        root.addArrangedSubview(appScroll)
        appScroll.heightAnchor.constraint(equalToConstant: 110).isActive = true
        appScroll.widthAnchor.constraint(equalTo: root.widthAnchor).isActive = true
        textToggle.target = self; textToggle.action = #selector(changeText)
        textToggle.state = capture.includeText ? .on : .off
        root.addArrangedSubview(textToggle)
        root.addArrangedSubview(label("Text: TextEdit document content and accessible static text in Mail, Outlook and Notes. No full inbox sync. Only enable communications with the other participants’ consent. Redaction is best effort; review before sharing. Activity: 24 hours / 1,000 records. Reviewed preferences: 90 days. Files are local, not encrypted by this app.", size: 11))

        for (id, title, width) in [("time", "Time", 85.0), ("app", "App", 150.0), ("activity", "Observed activity", 650.0)] {
            let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier(id))
            col.title = title; col.width = width
            table.addTableColumn(col)
        }
        table.delegate = self; table.dataSource = self; table.rowHeight = 27
        table.allowsMultipleSelection = false
        let scroll = NSScrollView()
        scroll.documentView = table; scroll.hasVerticalScroller = true; scroll.hasHorizontalScroller = true
        root.addArrangedSubview(scroll)
        scroll.widthAnchor.constraint(equalTo: root.widthAnchor).isActive = true
        scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 140).isActive = true
        detail.isEditable = false; detail.isSelectable = true
        detail.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        detail.textContainerInset = NSSize(width: 8, height: 8)
        detail.string = "Select an activity to inspect exactly what was saved."
        let detailScroll = NSScrollView()
        detailScroll.documentView = detail; detailScroll.hasVerticalScroller = true
        root.addArrangedSubview(detailScroll)
        detailScroll.widthAnchor.constraint(equalTo: root.widthAnchor).isActive = true
        detailScroll.heightAnchor.constraint(equalToConstant: 100).isActive = true
        root.addArrangedSubview(label("Turn a reviewed observation into a shopping preference", size: 16))
        keyMenu.addItems(withTitles: ["color", "shape"])
        keyMenu.target = self; keyMenu.action = #selector(changeKey)
        changeKey()
        root.addArrangedSubview(stack([keyMenu, valueMenu, button("Confirm preference from selected activity", #selector(remember))]))
        root.addArrangedSubview(memoryLabel)
        root.addArrangedSubview(stack([button("Export reviewed preferences…", #selector(export)), button("Open Along import", #selector(openAlong)), button("Delete all history & preferences…", #selector(clear))]))
    }

    private func buildHome() {
        homeWindow = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 510, height: 390),
                              styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        homeWindow.title = "Along"
        homeWindow.center()
        let root = stack([], vertical: true)
        root.spacing = 18
        root.translatesAutoresizingMaskIntoConstraints = false
        homeWindow.contentView!.addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: homeWindow.contentView!.leadingAnchor, constant: 36),
            root.trailingAnchor.constraint(equalTo: homeWindow.contentView!.trailingAnchor, constant: -36),
            root.topAnchor.constraint(equalTo: homeWindow.contentView!.topAnchor, constant: 32)
        ])
        let title = label("Make Along personal.", size: 28)
        title.font = .systemFont(ofSize: 28, weight: .semibold)
        root.addArrangedSubview(title)
        root.addArrangedSubview(label("Let Along use your Mac activity to learn what matters to you.", size: 16))
        let note = label("Access: app usage and readable text in TextEdit, Notes, Mail and Outlook. Browser content, password fields, screenshots and audio are excluded. Activity stays on this Mac; only preferences you approve go to Along.", size: 12)
        note.textColor = .secondaryLabelColor
        root.addArrangedSubview(note)
        allowButton.target = self
        allowButton.action = #selector(allow)
        allowButton.bezelStyle = .rounded
        allowButton.controlSize = .large
        allowButton.contentTintColor = .controlAccentColor
        allowButton.widthAnchor.constraint(equalToConstant: 160).isActive = true
        root.addArrangedSubview(allowButton)
        homeStatus.font = .systemFont(ofSize: 11)
        homeStatus.textColor = .secondaryLabelColor
        root.addArrangedSubview(homeStatus)
        let settings = button("Settings & history", #selector(showSettings))
        settings.isBordered = false
        settings.font = .systemFont(ofSize: 12)
        root.addArrangedSubview(settings)
        if UserDefaults.standard.bool(forKey: "contextAllowed") { allowButton.title = "Resume"; homeStatus.stringValue = "Paused. Resume when you're ready." }
    }

    @objc func allow() {
        if capture.running { pause(); return }
        if !AXIsProcessTrusted() {
            pendingAllow = true
            permission()
            homeStatus.stringValue = "Enable Along Context in macOS Accessibility, then return here."
            return
        }
        beginAllowedCapture()
    }
    private func beginAllowedCapture() {
        if !UserDefaults.standard.bool(forKey: "contextAllowed") {
            capture.allApps = true
            capture.includeText = true
            UserDefaults.standard.set(true, forKey: "allApps")
            UserDefaults.standard.set(true, forKey: "includeText")
            UserDefaults.standard.set(true, forKey: "contextAllowed")
            textToggle.state = .on
            refreshApps()
        }
        table.deselectAll(nil)
        _ = capture.start()
    }

    private func setStatus(_ text: String) {
        status.stringValue = text
        homeStatus.stringValue = text
        allowButton.title = capture.running ? "Pause" : UserDefaults.standard.bool(forKey: "contextAllowed") ? "Resume" : "Allow"
        startButton.title = capture.running ? "Pause recording" : "Start recording"
        statusItem?.button?.title = capture.running ? "Along ●" : "Along ○"
    }
    @objc func show() { homeWindow.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    @objc func showSettings() { refreshApps(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    @objc func pause() { pendingAllow = false; capture.stop(); setStatus("Paused. No new activity is being collected.") }
    @objc func quit() { capture.stop(); NSApp.terminate(nil) }
    @objc func toggle() {
        if capture.running { pause() } else {
            table.deselectAll(nil)
            detail.string = "Select an activity to review it. Recording pauses while you review."
            _ = capture.start()
        }
    }
    @objc func permission() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!)
        setStatus("Enable Along Context in Accessibility. If macOS requests it, quit and reopen this app. Then press Start recording.")
    }
    @objc func reveal() { NSWorkspace.shared.open(history.directory) }
    @objc func refreshApps() {
        if capture.running { pause() }
        for view in appStack.arrangedSubviews { appStack.removeArrangedSubview(view); view.removeFromSuperview() }
        let apps = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }.sorted { ($0.localizedName ?? "") < ($1.localizedName ?? "") }
        var seen = Set<String>()
        for app in apps {
            guard let id = app.bundleIdentifier, !CapturePolicy.blockedApps.contains(id), seen.insert(id).inserted else { continue }
            let mode = CapturePolicy.textApps.contains(id) ? "native text supported" : "activity counts only"
            let check = NSButton(checkboxWithTitle: "\(app.localizedName ?? id) · \(mode)", target: self, action: #selector(changeApp(_:)))
            check.identifier = NSUserInterfaceItemIdentifier(id)
            check.state = capture.isAllowed(id) ? .on : .off
            appStack.addArrangedSubview(check)
        }
    }
    @objc func changeApp(_ sender: NSButton) {
        pause()
        guard let id = sender.identifier?.rawValue else { return }
        if sender.state == .on { capture.allowedApps.insert(id) } else { capture.allowedApps.remove(id) }
        if capture.allApps {
            if sender.state == .on { capture.excludedApps.remove(id) } else { capture.excludedApps.insert(id) }
            UserDefaults.standard.set(Array(capture.excludedApps), forKey: "excludedApps")
        }
        UserDefaults.standard.set(Array(capture.allowedApps), forKey: "allowedApps")
    }
    @objc func changeText() {
        pause(); capture.includeText = textToggle.state == .on
        UserDefaults.standard.set(capture.includeText, forKey: "includeText")
    }
    @objc func changeKey() {
        valueMenu.removeAllItems()
        valueMenu.addItems(withTitles: CapturePolicy.values[keyMenu.titleOfSelectedItem ?? "color"] ?? [])
    }
    private var selectedActivity: Activity? {
        let index = history.activities.count - 1 - table.selectedRow
        guard table.selectedRow >= 0, history.activities.indices.contains(index) else { return nil }
        return history.activities[index]
    }
    @objc func remember() {
        guard let activity = selectedActivity, let key = keyMenu.titleOfSelectedItem, let value = valueMenu.titleOfSelectedItem else {
            setStatus("Select an activity first. You decide whether it supports a preference; this is not AI inference."); return
        }
        do { try history.remember(key: key, value: value, activity: activity); refreshMemories() }
        catch { setStatus("Could not save preference.") }
    }
    private func refreshMemories() {
        memoryLabel.stringValue = history.memories.isEmpty ? "No reviewed preferences yet. No automatic inference is running." : history.memories.map { "\($0.key): \($0.value) (reviewed, source: \($0.sourceApp))" }.joined(separator: " · ")
    }
    @objc func export() {
        guard !history.memories.isEmpty else { setStatus("Confirm a preference before exporting."); return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "along-context.json"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try history.exportData().write(to: url, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            setStatus("Exported reviewed preferences only. No activity text or raw history was exported.")
        } catch { setStatus("Could not export preferences.") }
    }
    @objc func openAlong() {
        NSWorkspace.shared.open(URL(string: "http://127.0.0.1:4331/context")!)
    }
    @objc func clear() {
        let alert = NSAlert()
        alert.messageText = "Delete all local history and reviewed preferences?"
        alert.informativeText = "Recording will pause. Exported files and preferences already imported into Along must be deleted separately."
        alert.addButton(withTitle: "Delete"); alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        pause()
        do { try history.clear(); table.reloadData(); refreshMemories(); detail.string = "Local history and preferences deleted." }
        catch { setStatus("Unable to delete local files. Open local files to inspect permissions.") }
    }
    func numberOfRows(in tableView: NSTableView) -> Int { history.activities.count }
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let item = history.activities[history.activities.count - 1 - row]
        let text: String
        switch tableColumn?.identifier.rawValue {
        case "time": text = item.timestamp.formatted(date: .omitted, time: .standard)
        case "app": text = item.app
        default: text = "\(item.count) × \(item.kind)\(item.title.isEmpty ? "" : " · " + item.title)"
        }
        return NSTextField(labelWithString: text)
    }
    func tableViewSelectionDidChange(_ notification: Notification) {
        guard let item = selectedActivity else { return }
        pause()
        detail.string = "\(item.app) · \(item.timestamp.formatted())\n\(item.title)\n\(item.excerpt.isEmpty ? "No text captured for this activity." : item.excerpt)"
    }
}

@main
struct AlongContextMain {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = CompanionDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        app.run()
        withExtendedLifetime(delegate) {}
    }
}
