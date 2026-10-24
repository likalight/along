import Foundation

@MainActor
final class PreferenceLearning {
    struct Connection: Decodable { let endpoint: URL; let token: String }
    var onStatus: ((String) -> Void)?
    private var connection: Connection?
    private var queue: [Activity] = []
    private var active = false
    private var epoch = 0
    private var timer: Timer?
    private var work: Task<Void, Never>?
    private var controlTask: Task<Void, Never>?

    init(directory: URL) {
        let file = directory.appendingPathComponent("connection.json")
        if let data = try? Data(contentsOf: file), let value = try? JSONDecoder().decode(Connection.self, from: data),
           value.endpoint.scheme == "http", value.endpoint.host == "127.0.0.1", value.token.count == 64 {
            connection = value
        }
    }
    var pairedURL: URL? {
        guard let connection, var parts = URLComponents(url: connection.endpoint.appendingPathComponent("context"), resolvingAgainstBaseURL: false) else { return nil }
        parts.fragment = "pair=\(connection.token)"
        return parts.url
    }
    func setRecording(_ enabled: Bool) {
        epoch += 1
        let current = epoch
        active = false
        work?.cancel(); work = nil
        timer?.invalidate(); timer = nil
        queue.removeAll()
        guard connection != nil else { onStatus?("Learning isn't connected. Start Along with the local launcher."); return }
        let previous = controlTask
        controlTask = Task { [weak self] in
            await previous?.value
            guard let self, self.epoch == current else { return }
            do {
                _ = try await self.send(["action": enabled ? "resume" : "pause"])
                guard self.epoch == current else { return }
                self.work = nil
                self.active = enabled
                if enabled {
                    self.timer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
                        MainActor.assumeIsolated { self?.flush() }
                    }
                    self.onStatus?("Learning is on. New shopping preferences sync automatically.")
                } else { self.onStatus?("Recording and learning paused.") }
            } catch {
                guard self.epoch == current else { return }
                self.work = nil
                self.onStatus?("Learning disconnected. Open Along and press Resume to retry.")
            }
        }
    }
    func observe(_ activity: Activity) {
        guard active, !activity.excerpt.isEmpty else { return }
        queue.append(activity)
        queue = Array(queue.suffix(8))
        flush()
    }
    private func flush() {
        guard active, work == nil, let item = queue.first else { return }
        let current = epoch
        work = Task { [weak self] in
            guard let self else { return }
            do {
                let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
                let activity = try JSONSerialization.jsonObject(with: encoder.encode(item))
                let result = try await self.send(["action": "observe", "activity": activity])
                guard self.epoch == current else { return }
                if result["enabled"] as? Bool == false {
                    self.active = false; self.queue.removeAll()
                    self.onStatus?("Learning paused in Along. Resume here when ready.")
                } else if result["accepted"] as? Bool == true {
                    self.queue.removeAll { $0.id == item.id }
                    self.onStatus?("Preferences synced to Along.")
                }
            } catch {
                guard self.epoch == current else { return }
                self.queue.removeAll { $0.timestamp < Date().addingTimeInterval(-300) }
                self.onStatus?("Waiting for Along. Retrying automatically.")
            }
            if self.epoch == current { self.work = nil }
        }
    }
    func forget() {
        setRecording(false)
        let previous = controlTask
        let current = epoch
        controlTask = Task { [weak self] in
            await previous?.value
            guard let self, self.epoch == current else { return }
            do { _ = try await self.send(["action": "forget"]); self.onStatus?("Learned preferences deleted.") }
            catch { self.onStatus?("Local history deleted. Along is offline; use Forget in Along to delete learned preferences.") }
        }
    }
    private func send(_ object: [String: Any]) async throws -> [String: Any] {
        guard let connection else { throw URLError(.notConnectedToInternet) }
        var request = URLRequest(url: connection.endpoint.appendingPathComponent("api/context"))
        request.httpMethod = "POST"; request.timeoutInterval = 40
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(connection.token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: object)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }
}
