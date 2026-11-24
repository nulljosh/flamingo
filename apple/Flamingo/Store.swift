import SwiftUI

// Settings and progress, kept on this device (UserDefaults), with the same keys and defaults as the web app.
@MainActor
final class Store: ObservableObject {
    struct MyPin: Codable, Equatable, Identifiable { var id: String; var name: String; var note: String; var x: Double; var y: Double; var at: Double }
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
        var savePct: String? = nil
        var linked: Bool? = nil   // this device has synced with the signed-in account
        var dirty: Bool? = nil    // progress changed since the last sync
        var recentQ: [String]? = nil
        var fav: [String: Double]? = nil
        var pins: [MyPin]? = nil
        var recentP: [String]? = nil
        var hinted: Bool? = nil
    }
    @Published var s: State {
        didSet {
            if !qa { save() }
            if !applying && (s.visited != oldValue.visited || s.done != oldValue.done || s.found != oldValue.found || s.savePct != oldValue.savePct || s.fav != oldValue.fav || s.pins != oldValue.pins) { account?.progressChanged() }
        }
    }
    weak var account: Account?
    private var applying = false
    func applyRemote(_ p: Sync.Progress) {
        applying = true; defer { applying = false }
        s.visited = p.visited; s.done = p.done; s.found = p.found; s.savePct = p.savePct.isEmpty ? nil : p.savePct; s.fav = p.fav; s.pins = p.pins
    }
    static var nowMs: Double { (Date().timeIntervalSince1970 * 1000).rounded() }   // same unit as the web app
    private var qa = false
    private let key = "flamingo.v1"

    init() {
        if let d = UserDefaults.standard.data(forKey: key), let v = try? JSONDecoder().decode(State.self, from: d) { s = v } else { s = State() }
        // QA hooks: launch arguments set state for screenshots
        let args = ProcessInfo.processInfo.arguments
        qa = args.contains { $0.hasPrefix("-qa") }   // QA runs never overwrite the saved state
        if args.contains("-qaDark") { s.theme = "dark" }
        if args.contains("-qaLight") { s.theme = "light" }
        if let i = args.firstIndex(of: "-qaPct"), args.indices.contains(i + 1) { s.savePct = args[i + 1] }
        if args.contains("-qaPin") { s.pins = [MyPin(id: "uqa", name: "Hidden stash", note: "Check the water tower before the heist", x: 640, y: 540, at: Store.nowMs)]; s.fav = ["vercetti-estate": 1] }
        if args.contains("-qaVisited") { s.visited["shore-court-garage"] = 1; s.visited["ocean-beach"] = 1; s.done["m1-01"] = 1; s.found["cocaine-flamingos"] = 12 }
    }
    private func save() { if let d = try? JSONEncoder().encode(s) { UserDefaults.standard.set(d, forKey: key) } }

    var scheme: ColorScheme? { s.theme == "dark" ? .dark : s.theme == "light" ? .light : nil }
    func toggleVisited(_ id: String) { if s.visited[id] != nil { s.visited[id] = nil } else { s.visited[id] = Store.nowMs } }
    func toggleDone(_ id: String) { if s.done[id] != nil { s.done[id] = nil } else { s.done[id] = Store.nowMs } }
    func step(_ c: Collectible, _ k: Int) { s.found[c.id] = max(0, min(c.total, (s.found[c.id] ?? 0) + k)) }
    func remember(query q: String) { let t = q.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }; s.recentQ = Array(([t] + (s.recentQ ?? []).filter { $0 != t }).prefix(6)) }
    func toggleFav(_ id: String) { var f = s.fav ?? [:]; f[id] = f[id] == nil ? Store.nowMs : nil; s.fav = f }
    func addPin(x: Double, y: Double) -> String { let p = MyPin(id: "u\(Int(Date().timeIntervalSince1970 * 1000))", name: "My pin", note: "", x: x, y: y, at: Store.nowMs); s.pins = (s.pins ?? []) + [p]; return p.id }
    func remember(place id: String) { s.recentP = Array(([id] + (s.recentP ?? []).filter { $0 != id }).prefix(6)) }
    var isQA: Bool { qa }
    func reset() { s.visited = [:]; s.done = [:]; s.found = [:] }

    func missionName(_ m: Mission) -> String { s.spoilers && m.name != nil ? m.name! : m.name != nil ? "Mission \(m.n)" : "Mission \(m.n) (name withheld)" }
    func chapterName(_ m: Mission) -> String { s.spoilers ? "Chapter \(m.chapter): \(m.chapterTitle)" : "Chapter \(m.chapter)" }
}
