import SwiftUI

// What the sheet shows: search, a place, a region, a mission, a collectible, or a list. One NavigationStack inside it.
struct SheetRoot: View {
    let start: Route
    @EnvironmentObject var model: MapModel
    @State private var path: [Route] = []
    var body: some View {
        NavigationStack(path: $path) {
            screen(start)
                .navigationDestination(for: Route.self) { screen($0) }
        }
    }
    @ViewBuilder func screen(_ r: Route) -> some View {
        switch r {
        case .search: SearchScreen()
        case .place(let id): PlaceScreen(place: D.places[id]!)
        case .region(let id): RegionScreen(region: D.regions[id]!)
        case .mission(let id): MissionScreen(mission: D.missions[id]!)
        case .collectible(let id): CollectibleScreen(item: D.collectibles[id]!)
        case .list(let id): ListScreen(cat: D.cats[id]!)
        }
    }
}

struct CloseButton: View {
    @EnvironmentObject var model: MapModel
    var body: some View {
        Button { model.route = nil; model.selected = nil } label: {
            Image(systemName: "xmark").font(.system(size: 14, weight: .bold)).foregroundStyle(.secondary)
                .frame(width: 30, height: 30).background(Color(uiColor: .tertiarySystemFill), in: Circle())
        }
        .accessibilityLabel("Close")
    }
}

// rows
struct PlaceRow: View {
    let p: Place
    @EnvironmentObject var store: Store
    var body: some View {
        NavigationLink(value: Route.place(p.id)) {
            HStack(spacing: 12) {
                Badge(symbol: D.cats[p.cat]!.symbol, color: D.cats[p.cat]!.tint)
                VStack(alignment: .leading, spacing: 1) {
                    Text(p.name).lineLimit(1)
                    Text(D.where_(p)).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                if store.s.visited[p.id] != nil { Image(systemName: "checkmark").font(.body.bold()).foregroundStyle(.green) }
            }
        }
    }
}
struct MissionRow: View {
    let m: Mission
    @EnvironmentObject var store: Store
    var body: some View {
        NavigationLink(value: Route.mission(m.id)) {
            HStack(spacing: 12) {
                Badge(symbol: "flag.fill", color: m.heist ? .pink : .gray)
                VStack(alignment: .leading, spacing: 1) {
                    Text(store.missionName(m) + (m.heist ? " · Heist" : "")).lineLimit(1)
                    Text("\(store.chapterName(m)) · \(m.who.isEmpty ? "Jason or Lucia" : m.who.joined(separator: " and "))").font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer()
                if store.s.done[m.id] != nil { Image(systemName: "checkmark").font(.body.bold()).foregroundStyle(.green) }
            }
        }
    }
}
struct RegionRow: View {
    let r: Region
    var body: some View {
        NavigationLink(value: Route.region(r.id)) {
            HStack(spacing: 12) {
                Image(systemName: "map.fill").font(.system(size: 15, weight: .semibold)).foregroundStyle(.white).frame(width: 32, height: 32).background(r.tint, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(r.name)
                    Text(r.inspiration).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
    }
}
struct CollectibleRow: View {
    let c: Collectible
    @EnvironmentObject var store: Store
    var body: some View {
        NavigationLink(value: Route.collectible(c.id)) {
            HStack(spacing: 12) {
                Badge(symbol: "sparkles", color: Color(hex: "#ff9500"))
                VStack(alignment: .leading, spacing: 1) {
                    Text(c.name)
                    Text("\(store.s.found[c.id] ?? 0) of \(c.total) found").font(.subheadline).foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct SearchScreen: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    @State private var q = ""
    @FocusState private var focused: Bool
    let cols = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)
    var body: some View {
        List {
            if q.trimmingCharacters(in: .whitespaces).isEmpty {
                Section("Browse") {
                    LazyVGrid(columns: cols, spacing: 12) {
                        ForEach(D.data.categories) { c in
                            NavigationLink(value: Route.list(c.id)) {
                                VStack(spacing: 6) {
                                    Badge(symbol: c.symbol, color: c.tint, size: 48)
                                    Text(c.shortName).font(.caption).multilineTextAlignment(.center).lineLimit(2).foregroundStyle(.primary)
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 6)
                }
                Section("Regions") { ForEach(D.data.regions) { RegionRow(r: $0) } }
                Section { } footer: { Text(D.data.disclaimer) }
            } else {
                let hits = Search.run(q, spoilers: store.s.spoilers)
                if hits.isEmpty {
                    ContentUnavailableView.search(text: q)
                } else {
                    let places: [Place] = hits.compactMap { if case .place(let p) = $0 { p } else { nil } }
                    let regions: [Region] = hits.compactMap { if case .region(let r) = $0 { r } else { nil } }
                    let missions: [Mission] = hits.compactMap { if case .mission(let m) = $0 { m } else { nil } }
                    let colls: [Collectible] = hits.compactMap { if case .collectible(let c) = $0 { c } else { nil } }
                    if !places.isEmpty { Section("Places") { ForEach(places) { PlaceRow(p: $0) } } }
                    if !regions.isEmpty { Section("Regions") { ForEach(regions) { RegionRow(r: $0) } } }
                    if !missions.isEmpty { Section("Missions") { ForEach(missions) { MissionRow(m: $0) } } }
                    if !colls.isEmpty { Section("Collectibles") { ForEach(colls) { CollectibleRow(c: $0) } } }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .safeAreaInset(edge: .top) {
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search Leonida", text: $q).focused($focused).submitLabel(.search).autocorrectionDisabled()
                    if !q.isEmpty { Button { q = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) } }
                }
                .padding(.horizontal, 12).frame(height: 44)
                .background(Color(uiColor: .tertiarySystemFill), in: Capsule())
                CloseButton()
            }
            .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 8)
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { if ProcessInfo.processInfo.environment["QA_QUERY"].map({ q = $0 }) == nil { focused = true } }
    }
}

struct Header: View {
    let symbol: String
    let color: Color
    let title: String
    let sub: String
    var badge: (String, Color)? = nil
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Badge(symbol: symbol, color: color, size: 52)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.title2.bold())
                Text(sub).font(.subheadline).foregroundStyle(.secondary)
                if let badge {
                    Text(badge.0).font(.caption.weight(.semibold)).foregroundStyle(badge.1)
                        .padding(.horizontal, 8).padding(.vertical, 3).background(badge.1.opacity(0.14), in: Capsule()).padding(.top, 6)
                }
            }
            Spacer(minLength: 0)
        }
    }
}

struct PlaceScreen: View {
    let place: Place
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    var body: some View {
        let cat = D.cats[place.cat]!
        let tag: (String, Color) = place.tag == "confirmed" ? ("Confirmed by Rockstar", .green) : place.tag == "spotted" ? ("Seen in official footage", .blue) : ("Fan theory", .orange)
        let here = D.data.places.filter { $0.at == place.id }
        let ms = D.data.missions.filter { $0.at == place.id }
        List {
            Section {
                VStack(alignment: .leading, spacing: 14) {
                    Header(symbol: cat.symbol, color: cat.tint, title: place.name, sub: D.where_(place), badge: tag)
                    Text(place.note).font(.body)
                    HStack(spacing: 8) {
                        let v = store.s.visited[place.id] != nil
                        Button { store.toggleVisited(place.id) } label: {
                            Label(v ? "Visited" : "Mark visited", systemImage: "checkmark").frame(maxWidth: .infinity).frame(height: 50)
                                .foregroundStyle(v ? .white : .pink).background(v ? Color.pink : Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        ShareLink(item: URL(string: "https://flamingo.jaybulb.com/app/#place/\(place.id)")!) {
                            Label("Share", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity).frame(height: 50)
                                .foregroundStyle(.pink).background(Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }
                    .font(.body.weight(.semibold)).buttonStyle(.plain)
                }
                .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
            if let parent = place.at.flatMap({ D.places[$0] }) { Section("Found at") { PlaceRow(p: parent) } }
            if !here.isEmpty { Section("Here") { ForEach(here) { PlaceRow(p: $0) } } }
            if !ms.isEmpty { Section("Missions that start here") { ForEach(ms) { MissionRow(m: $0) } } }
            if let r = place.region.flatMap({ D.regions[$0] }) {
                Section { RegionRow(r: r) } header: { Text("Region") } footer: { Text(place.pinned ? "Pin positions are approximate." : "Named in the game, but where it sits isn't known yet.") }
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton() } }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.selected = place.id; model.focus(place) }
    }
}

struct RegionScreen: View {
    let region: Region
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    var body: some View {
        let items = D.data.places.filter { $0.region == region.id && $0.cat != "people" }
            .sorted { (MapLayer.priority.firstIndex(of: $0.cat) ?? 99, $0.name) < (MapLayer.priority.firstIndex(of: $1.cat) ?? 99, $1.name) }
        let seen = items.filter { store.s.visited[$0.id] != nil }.count
        List {
            Section {
                VStack(alignment: .leading, spacing: 14) {
                    Header(symbol: "map.fill", color: region.tint, title: region.name, sub: "Inspired by \(region.inspiration)")
                    Text(region.blurb)
                    ProgressView(value: Double(seen), total: Double(max(1, items.count))).tint(.pink)
                    Text("\(seen) of \(items.count) visited").font(.footnote).foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
            Section("Places") { ForEach(items) { PlaceRow(p: $0) } }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton() } }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.selected = nil; model.zoomTo(items) }
    }
}

struct MissionScreen: View {
    let mission: Mission
    @EnvironmentObject var store: Store
    var body: some View {
        let done = store.s.done[mission.id] != nil
        List {
            Section {
                VStack(alignment: .leading, spacing: 14) {
                    Header(symbol: "flag.fill", color: mission.heist ? .pink : .gray, title: store.missionName(mission), sub: "\(store.chapterName(mission)) · Mission \(mission.n)", badge: mission.heist ? ("Heist", .pink) : nil)
                    Text("Played as \(mission.who.isEmpty ? "Jason or Lucia" : mission.who.joined(separator: " and ")).\(store.s.spoilers ? "" : " The name is hidden; turn on spoilers in Settings to see it.")")
                    Button { store.toggleDone(mission.id) } label: {
                        Label(done ? "Done" : "Mark done", systemImage: "checkmark").font(.body.weight(.semibold)).frame(maxWidth: .infinity).frame(height: 50)
                            .foregroundStyle(done ? .white : .pink).background(done ? Color.pink : Color(uiColor: .tertiarySystemFill), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
            if let at = mission.at.flatMap({ D.places[$0] }) { Section("Starts at") { PlaceRow(p: at) } }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton() } }
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct CollectibleScreen: View {
    let item: Collectible
    @EnvironmentObject var store: Store
    var body: some View {
        let n = store.s.found[item.id] ?? 0
        List {
            Section {
                VStack(alignment: .leading, spacing: 16) {
                    Header(symbol: "sparkles", color: Color(hex: "#ff9500"), title: item.name, sub: "Collectible · \(item.total) in Leonida")
                    Text(item.note)
                    HStack {
                        stepButton("minus", -1)
                        Spacer()
                        (Text("\(n)").font(.system(size: 40, weight: .bold)) + Text(" / \(item.total)").font(.body).foregroundColor(.secondary)).monospacedDigit()
                        Spacer()
                        stepButton("plus", 1)
                    }
                    ProgressView(value: Double(n), total: Double(item.total)).tint(.pink)
                    Text("Where each one sits isn't mapped yet. Count them here as you find them.").font(.footnote).foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton() } }
        .navigationBarTitleDisplayMode(.inline)
    }
    func stepButton(_ s: String, _ k: Int) -> some View {
        Button { store.step(item, k) } label: {
            Image(systemName: s).font(.title3.bold()).foregroundStyle(.pink).frame(width: 52, height: 52).background(Color(uiColor: .tertiarySystemFill), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(k > 0 ? "One more" : "One fewer")
    }
}

struct ListScreen: View {
    let cat: Category
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    var body: some View {
        List {
            Section { Header(symbol: cat.symbol, color: cat.tint, title: cat.name, sub: subtitle).listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4)) }
            if cat.id == "mission" {
                ForEach(1...5, id: \.self) { ch in
                    let ms = D.data.missions.filter { $0.chapter == ch }
                    Section(store.chapterName(ms[0])) { ForEach(ms) { MissionRow(m: $0) } }
                }
            } else if cat.id == "collectible" {
                Section { ForEach(D.data.collectibles) { CollectibleRow(c: $0) } }
            } else {
                let items = D.data.places.filter { $0.cat == cat.id }.sorted { $0.name < $1.name }
                ForEach(D.data.regions) { r in
                    let g = items.filter { $0.region == r.id }
                    if !g.isEmpty { Section(r.name) { ForEach(g) { PlaceRow(p: $0) } } }
                }
                let un = items.filter { $0.region == nil }
                if !un.isEmpty { Section("Not placed yet") { ForEach(un) { PlaceRow(p: $0) } } }
            }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton() } }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { if D.pinned.contains(where: { $0.cat == cat.id }) { model.filter = cat.id; model.zoomTo(D.pinned.filter { $0.cat == cat.id }) } }
    }
    var subtitle: String {
        cat.id == "mission" ? "\(D.data.missions.filter { store.s.done[$0.id] != nil }.count) of \(D.data.missions.count) done"
            : cat.id == "collectible" ? "\(D.data.collectibles.count) sets" : "\(D.data.places.filter { $0.cat == cat.id }.count) in Leonida"
    }
}
