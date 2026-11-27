import SwiftUI

@main
struct FlamingoApp: App {
    @StateObject private var store = Store()
    @StateObject private var model = MapModel()
    @StateObject private var account = Account()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(model)
                .environmentObject(account)
                .onAppear { store.account = account; account.store = store; Task { await account.pull() } }
                .preferredColorScheme(store.scheme)
                .tint(.pink)
        }
    }
}

enum Tab { case map, story, settings }

// Two tabs and a search button in a floating glass dock, as on iOS 26. The sheet holds search and details.
struct RootView: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    @EnvironmentObject var account: Account
    @Environment(\.horizontalSizeClass) private var hsize
    @State private var tab: Tab = .map
    @Namespace private var ns

    var body: some View {
        ZStack(alignment: .bottom) {
            MapScreen()
                .inspector(isPresented: Binding(get: { model.route != nil && tab == .map }, set: { if !$0 { model.route = nil; model.selected = nil } })) {
                    if let r = model.route {
                        SheetRoot(start: r).id(r.id)
                            .presentationDetents([.height(340), .medium, .large], selection: detent)
                            .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                            .presentationBackground(.regularMaterial)
                            .inspectorColumnWidth(min: 340, ideal: 380, max: 440)
                    }
                }
                .ignoresSafeArea(.container, edges: .bottom)
            if tab == .story { StoryView().transition(.opacity) }
            if tab == .settings { SettingsView().transition(.opacity) }
            if tab == .map && store.s.hinted != true && (!store.isQA || ProcessInfo.processInfo.arguments.contains("-qaHint")) { hint.padding(.bottom, 92).padding(.trailing, inspectorInset).transition(.move(edge: .bottom).combined(with: .opacity)) }
            dock.padding(.bottom, 8).padding(.trailing, inspectorInset)
        }
        .background(Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.027, green: 0.125, blue: 0.165, alpha: 1) : UIColor(red: 0.761, green: 0.906, blue: 0.933, alpha: 1) }).ignoresSafeArea())
        .animation(.easeInOut(duration: 0.22), value: tab)
        .animation(.easeInOut(duration: 0.22), value: inspectorInset)
        .onAppear(perform: qa)
    }

    // iPad: the inspector column takes the right edge, so centre the dock in the map column beside it
    private var inspectorInset: CGFloat { hsize == .regular && tab == .map && model.route != nil ? 380 : 0 }

    @State private var detentValue: PresentationDetent = .height(340)
    private var detent: Binding<PresentationDetent> {
        Binding(get: { model.route == .search ? (model.peek ? .height(340) : .large) : detentValue },
                set: { d in if model.route == .search { model.peek = d != .large } else { detentValue = d } })
    }

    // first run: three hints in one card, once
    private var hint: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Welcome to Leonida").font(.title3.bold())
            ForEach([("map", "Tap a region to zoom in. Tap a pin for its card."), ("magnifyingglass", "Search finds any place, mission or collectible."), ("checklist", "Story tracks your run. Type your save % to jump in.")], id: \.0) { sym, text in
                HStack(alignment: .top, spacing: 12) { Image(systemName: sym).foregroundStyle(Color.pink).frame(width: 22); Text(text).font(.subheadline).foregroundStyle(.secondary) }
            }
            Button { withAnimation { store.s.hinted = true } } label: { Text("Got it").font(.body.weight(.semibold)).frame(maxWidth: .infinity).frame(height: 48).foregroundStyle(.white).background(Color.pink, in: Capsule()) }
                .buttonStyle(.plain)
        }
        .padding(20)
        .frame(maxWidth: 360)
        .glass(RoundedRectangle(cornerRadius: 28, style: .continuous), interactive: false)
        .padding(.horizontal, 16)
    }
    private var dock: some View {
        HStack(spacing: 12) {
            Spacer(minLength: 0)
            HStack(spacing: 0) {
                tabButton(.map, "Map", "map")
                tabButton(.story, "Story", "checklist")
                tabButton(.settings, "Settings", "slider.horizontal.3")
            }
            .padding(4)
            .glass(Capsule())
            if tab == .map {
                Button { model.open(.search) } label: {
                    Image(systemName: "magnifyingglass").font(.system(size: 22, weight: .semibold)).foregroundStyle(.primary).frame(width: 64, height: 64)
                }
                .buttonStyle(.plain)
                .glass(Circle())
                .accessibilityLabel("Search")
                .transition(.scale.combined(with: .opacity))
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)   // always the full width, so the group stays centred with or without search
    }
    private func tabButton(_ t: Tab, _ title: String, _ symbol: String) -> some View {
        Button { tab = t } label: {
            VStack(spacing: 2) {
                Image(systemName: symbol).font(.system(size: 20, weight: .semibold))
                Text(title).font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(tab == t ? Color.pink : .primary)
            .frame(width: 84, height: 56)
            .background { if tab == t { Capsule().fill(Color(uiColor: .tertiarySystemFill)).matchedGeometryEffect(id: "pill", in: ns) } }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(tab == t ? .isSelected : [])
    }

    // QA hooks for screenshots: -qaRoute place/<id>, -qaTab settings, -qaZoom <x>,<y>,<factor>
    private func qa() {
        let a = ProcessInfo.processInfo.arguments
        func arg(_ k: String) -> String? { a.firstIndex(of: k).flatMap { a.indices.contains($0 + 1) ? a[$0 + 1] : nil } }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            if arg("-qaTab") == "settings" { tab = .settings }
            if arg("-qaTab") == "story" { tab = .story }
            if let i = a.firstIndex(of: "-qaLogin"), a.indices.contains(i + 2) { Task { await account.signIn(a[i + 1], a[i + 2]) } }
            if let z = arg("-qaZoom")?.split(separator: ",").compactMap({ Double($0) }), z.count == 3 {
                let s = model.fitS * z[2]
                model.go(Cam(s: s, x: model.size.width / 2 - z[0] * s, y: model.size.height * 0.42 - z[1] * s), animated: false)
            }
            if let r = arg("-qaRoute") {
                let p = r.split(separator: "/").map(String.init)
                switch p.first {
                case "search": model.open(.search)
                case "layers": model.open(.layers)
                case "pin": model.open(.pin(p[1]))
                case "place": model.open(.place(p[1]))
                case "region": model.open(.region(p[1]))
                case "list": model.open(.list(p[1]))
                default: break
                }
            }
        }
    }
}
