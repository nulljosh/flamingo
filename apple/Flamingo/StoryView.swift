import SwiftUI

// A port of web/app/story.js: the save's completion % mapped onto the 91 missions.
enum Story {
    static let share = 60.0 // assumed share of a 100% save that is story, as in GTA V
    static func missionsDone(_ percent: Double, total: Int) -> Int {
        let p = max(0, min(100, percent))
        return min(total, Int((Double(total) * min(1, p / share)).rounded()))
    }
}

struct StoryView: View {
    @EnvironmentObject var store: Store
    @State private var pct = ""
    @FocusState private var focused: Bool
    var ms: [Mission] { D.data.missions }

    var body: some View {
        let n = ms.filter { store.s.done[$0.id] != nil }.count
        let next = ms.first { store.s.done[$0.id] == nil }
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        (Text("\(n)").font(.system(size: 44, weight: .bold)) + Text(" / \(ms.count) missions").font(.body).foregroundColor(.secondary)).monospacedDigit()
                        ProgressView(value: Double(n), total: Double(ms.count)).tint(.pink).scaleEffect(y: 1.6)
                        if let next { (Text("Next up: ").foregroundColor(.secondary) + Text(whereText(next)).bold()).font(.subheadline) } else { Text("Story complete.").bold() }
                    }
                    .padding(.vertical, 6)
                }
                Section {
                    HStack {
                        Text("Completion on your save")
                        Spacer()
                        HStack(spacing: 2) {
                            TextField("0", text: $pct).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 56).focused($focused)
                            Text("%")
                        }
                        .font(.title3.weight(.semibold)).monospacedDigit()
                        .padding(.horizontal, 12).frame(height: 44).background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                    }
                    if let p = Double(pct.replacingOccurrences(of: ",", with: ".")) {
                        let k = Story.missionsDone(p, total: ms.count)
                        VStack(alignment: .leading, spacing: 12) {
                            if k >= ms.count { Text("That's past the end of the story: all \(ms.count) missions are probably done.") }
                            else { Text("About ") + Text("\(k) of \(ms.count)").bold() + Text(" missions done. You're probably on ") + Text(whereText(ms[k])).bold() + Text(".") }
                            Button {
                                var d = store.s.done
                                for (i, m) in ms.enumerated() { if i < k { if d[m.id] == nil { d[m.id] = Store.nowMs } } else { d[m.id] = nil } }
                                store.s.done = d
                                focused = false
                            } label: {
                                Label("Mark the first \(k) done", systemImage: "checkmark").font(.body.weight(.semibold)).frame(maxWidth: .infinity).frame(height: 48)
                                    .foregroundStyle(.pink).background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                        .font(.subheadline).foregroundStyle(.secondary)
                    } else {
                        Text("Enter the % from your save's pause menu and Flamingo guesses where you are.").font(.subheadline).foregroundStyle(.secondary)
                    }
                } header: { Text("Where am I?") } footer: { Text("A guess. It assumes the story is about \(Int(Story.share))% of a 100% save, as in GTA V. Rockstar hasn't published the real weights.") }
                ForEach(1...5, id: \.self) { ch in
                    let cm = ms.filter { $0.chapter == ch }
                    Section {
                        ForEach(cm) { m in row(m, isNext: m.id == next?.id) }
                    } header: {
                        HStack { Text(store.chapterName(cm[0])); Spacer(); Text("\(cm.filter { store.s.done[$0.id] != nil }.count) / \(cm.count)").monospacedDigit() }
                    }
                }
                Section("Places") {
                    ForEach(D.data.categories.filter { c in c.id != "people" && c.id != "vehicle" && D.pinned.contains { $0.cat == c.id } }) { c in
                        let items = D.pinned.filter { $0.cat == c.id }, seen = items.filter { store.s.visited[$0.id] != nil }.count
                        HStack(spacing: 12) {
                            Badge(symbol: c.symbol, color: c.tint)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(c.name)
                                HStack(spacing: 8) {
                                    ProgressView(value: Double(seen), total: Double(max(1, items.count))).tint(c.tint).frame(maxWidth: 110)
                                    Text("\(seen) / \(items.count) visited").font(.subheadline).foregroundStyle(.secondary).monospacedDigit()
                                }
                            }
                        }
                    }
                }
                Section("Collectibles") {
                    ForEach(D.data.collectibles) { c in
                        HStack(spacing: 12) {
                            Badge(symbol: "sparkles", color: Color(hex: "#ff9500"))
                            VStack(alignment: .leading, spacing: 1) { Text(c.name); Text("\(c.total) in Leonida").font(.subheadline).foregroundStyle(.secondary) }
                            Spacer()
                            Stepper("\(store.s.found[c.id] ?? 0)/\(c.total)", onIncrement: { store.step(c, 1) }, onDecrement: { store.step(c, -1) }).fixedSize().monospacedDigit()
                        }
                    }
                }
                Color.clear.frame(height: 60).listRowBackground(Color.clear)
            }
            .readableColumn()
            .navigationTitle("Story")
            .onAppear { pct = store.s.savePct ?? "" }
            .onChange(of: pct) { store.s.savePct = $0 }
            .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focused = false } } }
        }
    }

    func whereText(_ m: Mission) -> String { "\(store.chapterName(m)), mission \(m.n)" + (store.s.spoilers && m.name != nil ? ": \(m.name!)" : "") }

    func row(_ m: Mission, isNext: Bool) -> some View {
        let done = store.s.done[m.id] != nil
        return Button { store.toggleDone(m.id) } label: {
            HStack(spacing: 12) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.system(size: 24)).foregroundStyle(done ? Color.green : Color(uiColor: .tertiaryLabel))
                VStack(alignment: .leading, spacing: 1) {
                    Text(store.missionName(m)).foregroundStyle(done ? .secondary : .primary)
                    (isNext ? Text("Next up · ").foregroundColor(.pink).bold() : Text("")) + Text(m.who.isEmpty ? "Jason or Lucia" : m.who.joined(separator: " and ")).foregroundColor(.secondary)
                        .font(.subheadline)
                }
                .font(.body)
                Spacer()
                if m.heist { Text("Heist").font(.caption2.weight(.bold)).foregroundStyle(.pink).padding(.horizontal, 7).padding(.vertical, 2).background(Color.pink.opacity(0.13), in: Capsule()) }
            }
        }
        .buttonStyle(.plain)
        .listRowBackground(isNext ? Color.pink.opacity(0.09) : nil)
        .accessibilityAddTraits(done ? .isSelected : [])
    }
}
