import Foundation

struct Activity: Codable, Identifiable {
    var id = UUID().uuidString
    var timestamp = Date()
    var app: String
    var bundleID: String
    var kind: String
    var count: Int
    var title: String
    var excerpt: String
}

struct ReviewedMemory: Codable, Identifiable {
    var id = UUID().uuidString
    var key: String
    var value: String
    var sourceApp: String
    var sourceEventID: String
    var observedAt: Date
    var approvedAt = Date()
}

struct ContextExport: Encodable {
    let schemaVersion = 1
    let source = "along-mac-companion"
    var exportedAt = Date()
    var memories: [ReviewedMemory]
}

enum CapturePolicy {
    // Unknown browsers and embedded web views must not receive text access either:
    // text capture is limited to the known native apps below, never the inverse.
    static let textApps: Set<String> = ["com.apple.TextEdit", "com.apple.Notes", "com.apple.mail", "com.microsoft.Outlook"]
    static let blockedApps: Set<String> = [
        "com.apple.keychainaccess", "com.apple.Passwords", "com.1password.1password",
        "com.agilebits.onepassword7", "com.bitwarden.desktop", "com.apple.systempreferences",
        "dev.along.context"
    ]
    static let values: [String: [String]] = [
        "color": ["black", "navy", "olive", "khaki", "slate"],
        "shape": ["backpack", "tote", "sling", "duffel"]
    ]

    static func redact(_ value: String, limit: Int = 1200) -> String {
        var result = String(value.prefix(4000))
        let patterns = [
            #"(?i)\b(?:bearer\s+\S+|sk-[a-z0-9_-]{8,})"#,
            #"(?i)\b(?:password|passcode|secret|token|api[_ -]?key|verification code|one.time code|otp)\b[^\n]*"#,
            #"\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b"#,
            #"\b\d{4,}\b"#,
            #"https?://\S+"#
        ]
        for pattern in patterns {
            result = result.replacingOccurrences(of: pattern, with: "[redacted]", options: .regularExpression)
        }
        return String(result.prefix(limit))
    }
}

@MainActor
final class LocalHistory {
    let directory: URL
    private(set) var activities: [Activity] = []
    private(set) var memories: [ReviewedMemory] = []
    let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()

    init(directory: URL? = nil) throws {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("AlongContext", isDirectory: true)
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true,
                                               attributes: [.posixPermissions: 0o700])
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: self.directory.path)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let historyFile = self.directory.appendingPathComponent("activity.json")
        let memoryFile = self.directory.appendingPathComponent("memories.json")
        if FileManager.default.fileExists(atPath: historyFile.path) {
            activities = try decoder.decode([Activity].self, from: Data(contentsOf: historyFile))
        }
        if FileManager.default.fileExists(atPath: memoryFile.path) {
            memories = try decoder.decode([ReviewedMemory].self, from: Data(contentsOf: memoryFile))
        }
        try prune()
    }

    func write<T: Encodable>(_ value: T, name: String) throws {
        let destination = directory.appendingPathComponent(name)
        try encoder.encode(value).write(to: destination, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: destination.path)
    }

    func prune() throws {
        activities = Array(activities.filter { $0.timestamp > Date().addingTimeInterval(-86400) }.suffix(1000))
        memories = memories.filter { $0.approvedAt > Date().addingTimeInterval(-90 * 86400) }
        try write(activities, name: "activity.json")
        try write(memories, name: "memories.json")
    }

    func append(_ activity: Activity) throws {
        activities.append(activity)
        try prune()
    }

    func remember(key: String, value: String, activity: Activity) throws {
        guard CapturePolicy.values[key]?.contains(value) == true else { return }
        memories.removeAll { $0.key == key }
        memories.append(ReviewedMemory(key: key, value: value, sourceApp: activity.app,
                                       sourceEventID: activity.id, observedAt: activity.timestamp))
        try write(memories, name: "memories.json")
    }

    func clear() throws {
        activities = []
        memories = []
        try write(activities, name: "activity.json")
        try write(memories, name: "memories.json")
    }

    func exportData() throws -> Data {
        try prune()
        return try encoder.encode(ContextExport(memories: memories))
    }
}
