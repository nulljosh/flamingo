import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var store: Store
    @State private var confirmReset = false
    var body: some View {
        NavigationStack {
            Form {
                AccountSection()
                Section("Progress") {
                    HStack(spacing: 8) {
                        stat(D.data.places.filter { store.s.visited[$0.id] != nil }.count, D.pinned.filter { $0.cat != "people" }.count, "Places visited")
                        stat(D.data.missions.filter { store.s.done[$0.id] != nil }.count, D.data.missions.count, "Missions done")
                        stat(D.data.collectibles.reduce(0) { $0 + min($1.total, store.s.found[$1.id] ?? 0) }, D.data.collectibles.reduce(0) { $0 + $1.total }, "Collectibles")
                    }
                    .listRowBackground(Color.clear).listRowInsets(EdgeInsets())
                }
                Section("Appearance") {
                    Picker("Appearance", selection: $store.s.theme) {
                        Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark")
                    }
                    .pickerStyle(.segmented).labelsHidden()
                }
                Section("Map") {
                    Toggle(isOn: $store.s.labels) { row("Place names", "Show names next to pins when zoomed in") }
                    Toggle(isOn: $store.s.regions) { row("Region colours", "Tint each of the six regions in its own colour") }
                    Toggle(isOn: $store.s.cluster) { row("Group nearby pins", "Merge pins that overlap into a count") }
                    Toggle("Hide visited places", isOn: $store.s.hideVisited)
                }
                Section {
                    ForEach(D.data.categories.filter { c in c.id != "people" && c.id != "vehicle" && D.pinned.contains { $0.cat == c.id } }) { c in
                        Toggle(isOn: Binding(get: { !store.s.hidden.contains(c.id) }, set: { on in
                            if on { store.s.hidden.removeAll { $0 == c.id } } else { store.s.hidden.append(c.id) }
                        })) { HStack(spacing: 12) { Badge(symbol: c.symbol, color: c.tint, size: 30); Text(c.name) } }
                    }
                } header: { Text("Show on the map") } footer: { Text("Characters and vehicles show from their chips, or on the place they belong to.") }
                Section { Toggle(isOn: $store.s.spoilers) { row("Show mission and chapter names", "Off until you've played them") } } header: { Text("Spoilers") }
                Section {
                    ShareLink(item: exportURL()) { Text("Export progress") }
                    Button(role: .destructive) { confirmReset = true } label: { Text("Reset progress") }
                        .confirmationDialog("Reset all progress?", isPresented: $confirmReset, titleVisibility: .visible) {
                            Button("Reset progress", role: .destructive) { store.reset() }
                        } message: { Text("Visited places, finished missions and collectible counts are cleared.") }
                } header: { Text("Data") } footer: { Text("Progress stays on this device unless you sign in; then it syncs to your account at api.jaybulb.com. Nothing else is collected.") }
                Section {
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                    LabeledContent("Map data", value: D.data.updated)
                    Link("Source code", destination: URL(string: "https://github.com/nulljosh/flamingo")!)
                    Link("Report a wrong pin", destination: URL(string: "mailto:info@jaybulb.com?subject=Flamingo%20map")!)
                } header: { Text("About") } footer: {
                    Text("\(D.data.disclaimer) Grand Theft Auto is a trademark of Take-Two Interactive. Place names come from Rockstar's trailers and site, cross-checked against community maps.")
                }
                Color.clear.frame(height: 60).listRowBackground(Color.clear)
            }
            .readableColumn()
            .navigationTitle("Settings")
        }
    }
    func row(_ t: String, _ s: String) -> some View { VStack(alignment: .leading, spacing: 2) { Text(t); Text(s).font(.subheadline).foregroundStyle(.secondary) } }
    func stat(_ n: Int, _ of: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            (Text("\(n)").font(.system(size: 26, weight: .bold)) + Text(" / \(of)").font(.subheadline).foregroundColor(.secondary)).monospacedDigit()
            Text(label).font(.footnote).foregroundStyle(.secondary)
            ProgressView(value: Double(n), total: Double(max(1, of))).tint(.pink).padding(.top, 4)
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
    func exportURL() -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("flamingo-progress.json")
        let body: [String: Any] = ["app": "flamingo", "visited": store.s.visited, "done": store.s.done, "found": store.s.found]
        if let d = try? JSONSerialization.data(withJSONObject: body, options: [.prettyPrinted, .sortedKeys]) { try? d.write(to: url) }
        return url
    }
}
