import SwiftUI

// Settings and progress, kept on this device (UserDefaults), with the same keys and defaults as the web app.
@MainActor
final class Store: ObservableObject {
    struct State: Codable, Equatable {
        var theme = "system"
        var labels = true
        var regions = false
        var cluster = true
        var spoilers = false
        var hideVisited = false
        var hidden: [String] = []
        var visited: [String: Double] = [:]
        var done: [String: Double] = [:]
        var found: [String: Int] = [:]
    }
    @Published var s: State { didSet { if !qa { save() } } }
    private var qa = false
    private let key = "flamingo.v1"

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let v = try? JSONDecoder().decode(State.self, from: d) { s = v } else { s = State() }
        // QA hooks: launch arguments set state for screenshots
        let args = ProcessInfo.processInfo.arguments
        qa = args.contains { $0.hasPrefix("-qa") }   // QA runs never overwrite the saved state
        if args.contains("-qaDark") { s.theme = "dark" }
        if args.contains("-qaLight") { s.theme = "light" }
        if args.contains("-qaVisited") { s.visited["shore-court-garage"] = 1; s.visited["ocean-beach"] = 1; s.done["m1-01"] = 1; s.found["cocaine-flamingos"] = 12 }
    }
    private func save() { if let d = try? JSONEncoder().encode(s) { UserDefaults.standard.set(d, forKey: key) } }

    var scheme: ColorScheme? { s.theme == "dark" ? .dark : s.theme == "light" ? .light : nil }
    func toggleVisited(_ id: String) { if s.visited[id] != nil { s.visited[id] = nil } else { s.visited[id] = Date().timeIntervalSince1970 } }
    func toggleDone(_ id: String) { if s.done[id] != nil { s.done[id] = nil } else { s.done[id] = Date().timeIntervalSince1970 } }
    func step(_ c: Collectible, _ k: Int) { s.found[c.id] = max(0, min(c.total, (s.found[c.id] ?? 0) + k)) }
    func reset() { s.visited = [:]; s.done = [:]; s.found = [:] }

    func missionName(_ m: Mission) -> String { s.spoilers && m.name != nil ? m.name! : m.name != nil ? "Mission \(m.n)" : "Mission \(m.n) (name withheld)" }
    func chapterName(_ m: Mission) -> String { s.spoilers ? "Chapter \(m.chapter): \(m.chapterTitle)" : "Chapter \(m.chapter)" }
}
