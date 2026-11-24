import SwiftUI

enum Route: Hashable, Identifiable {
    case search, layers, pin(String), place(String), region(String), mission(String), collectible(String), list(String)
    var id: String { "\(self)" }
}

struct Cam: Equatable { var s: CGFloat = 1, x: CGFloat = 0, y: CGFloat = 0 }

// The map's camera and what is picked, shared by the map and the sheet.
@MainActor
final class MapModel: ObservableObject {
    @Published var cam = Cam()
    @Published var selected: String?
    @Published var filter: String?
    @Published var route: Route?
    @Published var hits: [String]?      // search matches, drawn as lettered pins while search is open
    @Published var peek = false         // search sheet folded down to show the matches
    var size: CGSize = .zero
    var fitS: CGFloat = 1
    var sheetInset: CGFloat = 0

    // the land's bounds, Keys included
    static let bounds: CGRect = {
        let pts = D.data.map.land + D.data.map.keys.map { [$0[0], $0[1]] }
        let xs = pts.map { $0[0] }, ys = pts.map { $0[1] }
        return CGRect(x: xs.min()! - 20, y: ys.min()! - 20, width: xs.max()! - xs.min()! + 40, height: ys.max()! - ys.min()! + 50)
    }()

    func fit(top: CGFloat = 70, bottom: CGFloat = 110) -> Cam {
        let b = Self.bounds, w = size.width, h = size.height
        let s = min((w - 16) / b.width, (h - top - bottom) / b.height)
        return Cam(s: s, x: (w - b.width * s) / 2 - b.minX * s, y: top + (h - top - bottom - b.height * s) / 2 - b.minY * s)
    }
    func clamp(_ c: Cam) -> Cam {
        var c = c
        c.s = min(max(c.s, fitS * 0.7), fitS * 14)
        let W = D.data.size[0], H = D.data.size[1]
        c.x = min(max(c.x, size.width * 0.2 - W * c.s), size.width * 0.8)
        c.y = min(max(c.y, size.height * 0.2 - H * c.s), size.height * 0.8)
        return c
    }
    func go(_ c: Cam, animated: Bool = true) {
        if animated { withAnimation(.smooth(duration: 0.45)) { cam = clamp(c) } } else { cam = clamp(c) }
    }
    func focus(_ p: Place) {
        guard p.pinned else { return }
        let s = max(cam.s, fitS * 3.2)
        let cy = min(size.height * 0.3, size.height - sheetInset - 80)
        go(Cam(s: s, x: size.width / 2 - p.point.x * s, y: cy - p.point.y * s))
    }
    func zoomTo(_ items: [Place], bottom: CGFloat = 140) {
        let ps = items.filter(\.pinned)
        guard !ps.isEmpty else { return }
        let xs = ps.map { $0.point.x }, ys = ps.map { $0.point.y }
        let x0 = xs.min()!, x1 = xs.max()!, y0 = ys.min()!, y1 = ys.max()!
        let pad: CGFloat = 80
        let top: CGFloat = 110, avail = size.height - top - bottom
        let s = min((size.width - pad * 2) / max(30, x1 - x0), (avail - pad) / max(30, y1 - y0), fitS * 14)
        go(Cam(s: s, x: size.width / 2 - (x0 + x1) / 2 * s, y: top + avail / 2 - (y0 + y1) / 2 * s))
    }
    func zoom(_ f: CGFloat, at p: CGPoint) {
        let s = min(max(cam.s * f, fitS * 0.7), fitS * 14), k = s / cam.s
        go(Cam(s: s, x: p.x - (p.x - cam.x) * k, y: p.y - (p.y - cam.y) * k))
    }
    func open(_ r: Route) {
        if case .place(let id) = r { selected = id; if let p = D.places[id] { focus(p) } }
        else if case .pin(let id) = r { selected = id }
        else { selected = nil }
        if r != .search { hits = nil; peek = false }
        route = r
    }
}

struct MapScreen: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    @State private var start: Cam?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                MapLayer(cam: model.cam, size: geo.size, selected: model.selected, filter: model.filter, hits: model.route == .search ? model.hits : nil, st: store.s, fitS: model.fitS,
                         tapPlace: { model.open(.place($0)) }, tapGroup: { model.zoomTo($0) }, tapPin: { model.open(.pin($0)) })
                    .gesture(pan.simultaneously(with: pinch))
                    .simultaneousGesture(dropPin)
                    .onTapGesture(count: 2, coordinateSpace: .local) { model.zoom(2, at: $0) }
                    .ignoresSafeArea()
                VStack(spacing: 0) {
                    Chips()
                    HStack { Spacer(); Controls() }.padding(.horizontal, 16).padding(.top, 4)
                    Spacer()
                }
            }
            .onAppear { setSize(geo.size, first: true) }
            .onChange(of: geo.size) { setSize($0, first: false) }
        }
        .ignoresSafeArea(edges: .bottom)
        .background(Color(hex: "#c2e7ee").opacity(0.0001))
    }

    private func setSize(_ s: CGSize, first: Bool) {
        model.size = s
        let f = model.fit()
        model.fitS = f.s
        if first || model.route == nil { model.cam = f }
        // the iPad inspector column changes the width: keep the picked place in view
        else if let id = model.selected, let p = D.places[id] { model.focus(p) }
    }
    private var pan: some Gesture {
        DragGesture(minimumDistance: 2)
            .onChanged { v in
                if start == nil { start = model.cam }
                guard let s0 = start else { return }
                model.cam = model.clamp(Cam(s: model.cam.s, x: s0.x + v.translation.width, y: s0.y + v.translation.height))
            }
            .onEnded { v in
                guard let s0 = start else { return }
                start = nil
                let flingX = (v.predictedEndTranslation.width - v.translation.width) * 0.6
                let flingY = (v.predictedEndTranslation.height - v.translation.height) * 0.6
                model.go(Cam(s: model.cam.s, x: s0.x + v.translation.width + flingX, y: s0.y + v.translation.height + flingY))
            }
    }
    // long-press the map to drop your own pin there
    private var dropPin: some Gesture {
        LongPressGesture(minimumDuration: 0.5).sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .local))
            .onEnded { v in
                guard case .second(true, let drag?) = v, hypot(drag.translation.width, drag.translation.height) < 8 else { return }
                let c = model.cam
                let id = store.addPin(x: (drag.startLocation.x - c.x) / c.s, y: (drag.startLocation.y - c.y) / c.s)
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                model.open(.pin(id))
            }
    }
    @State private var pinchStart: Cam?
    private var pinch: some Gesture {
        MagnifyGesture()
            .onChanged { v in
                if pinchStart == nil { pinchStart = model.cam }
                guard let c = pinchStart else { return }
                let s = min(max(c.s * v.magnification, model.fitS * 0.7), model.fitS * 14), k = s / c.s
                let a = v.startLocation
                model.cam = model.clamp(Cam(s: s, x: a.x - (a.x - c.x) * k, y: a.y - (a.y - c.y) * k))
                start = nil
            }
            .onEnded { _ in pinchStart = nil }
    }
}

// Draws the map and places the pins for one camera. Animatable, so a camera change animates the map and pins together.
struct MapLayer: View, Animatable {
    var cam: Cam
    let size: CGSize
    let selected: String?
    let filter: String?
    let hits: [String]?
    let st: Store.State
    let fitS: CGFloat
    let tapPlace: (String) -> Void
    let tapGroup: ([Place]) -> Void
    var tapPin: (String) -> Void = { _ in }
    @Environment(\.colorScheme) private var scheme

    var animatableData: AnimatablePair<CGFloat, AnimatablePair<CGFloat, CGFloat>> {
        get { AnimatablePair(cam.s, AnimatablePair(cam.x, cam.y)) }
        set { cam = Cam(s: newValue.first, x: newValue.second.first, y: newValue.second.second) }
    }

    static let priority = ["district", "safehouse", "landmark", "race", "store", "business", "activity", "transport", "nature", "weapons", "waink", "meditation", "vehicle", "people"]
    static let land = smoothPath(D.data.map.land)
    static let islands = D.data.map.islands.map { smoothPath($0.pts) }
    static let keys: [Path] = D.data.map.keys.map { k in
        Path(ellipseIn: CGRect(x: -k[2], y: -k[3], width: k[2] * 2, height: k[3] * 2))
            .applying(CGAffineTransform(rotationAngle: k[4] * .pi / 180).concatenating(CGAffineTransform(translationX: k[0], y: k[1])))
    }
    static let roads = D.data.map.roads.map { smoothPath($0.pts, closed: false) }
    static let cover: [(Path, String)] = [("mount-kalaga", "forest"), ("grassrivers", "wetland"), ("ambrosia", "farm"), ("vice-city", "city")].compactMap { id, kind in
        D.regions[id].map { (polygon($0.poly), kind) }
    }
    static let towns: [CGRect] = [[812, 830, 70, 90], [170, 390, 46, 38], [660, 568, 36, 28], [316, 770, 22, 18], [482, 704, 22, 16]].map { CGRect(x: $0[0] - $0[2], y: $0[1] - $0[3], width: $0[2] * 2, height: $0[3] * 2) }

    var dark: Bool { scheme == .dark }
    func c(_ light: String, _ darkHex: String) -> Color { Color(hex: dark ? darkHex : light) }

    var body: some View {
        let z = cam.s / fitS
        let overview = z < 1.45 && filter == nil && selected == nil && hits == nil
        let groups = overview ? [] : makeGroups()
        ZStack(alignment: .topLeading) {
            Canvas { ctx, _ in draw(&ctx, z: z) }
            // region cards when zoomed out, region names when in
            ForEach(D.data.regions) { r in
                let p = pt(r.label[0], r.label[1])
                if overview {
                    let n = D.pinned.filter { $0.region == r.id && $0.cat != "people" && $0.cat != "vehicle" }
                    Button { tapGroup(n) } label: {
                        HStack(spacing: 8) {
                            Text(r.short).font(.system(size: 16, weight: .semibold)).foregroundStyle(.primary)
                            Text("\(n.count)").font(.system(size: 14, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                                .frame(minWidth: 30, minHeight: 30).padding(.horizontal, 2).background(r.tint, in: Capsule())
                        }
                        .padding(.leading, 16).padding(.trailing, 6).frame(height: 44)
                        .glass(Capsule())
                    }
                    .buttonStyle(.plain)
                    .position(x: min(max(p.x, CGFloat(r.short.count) * 4.6 + 44), size.width - CGFloat(r.short.count) * 4.6 - 44), y: p.y)
                    .accessibilityLabel("\(r.name), \(n.count) places")
                } else if z < 3.4 {
                    Text(r.short.uppercased()).font(.system(size: 12, weight: .bold)).tracking(1.6).foregroundStyle(.secondary)
                        .shadow(color: dark ? .black : .white, radius: 2).position(p).allowsHitTesting(false)
                }
            }
            labels(groups, z: z)
            if !overview && hits == nil && (filter == nil || filter == "mypin") {
                ForEach(st.pins ?? []) { p in
                    MyPinView(selected: p.id == selected)
                        .position(pt(p.x, p.y))
                        .onTapGesture { tapPin(p.id) }
                        .accessibilityLabel("\(p.name), your pin").accessibilityAddTraits(.isButton)
                }
            }
            ForEach(groups, id: \.key) { g in
                if g.items.count == 1, let p = g.items.first {
                    PinView(place: p, selected: p.id == selected, visited: st.visited[p.id] != nil, letter: hits?.firstIndex(of: p.id).map { String(UnicodeScalar(65 + $0)!) })
                        .position(g.at)
                        .onTapGesture { tapPlace(p.id) }
                        .accessibilityAddTraits(.isButton)
                        .accessibilityLabel("\(p.name), \(D.cats[p.cat]?.one ?? "")")
                } else {
                    let color = D.cats[g.items[0].cat]?.tint ?? .gray
                    Text("\(g.items.count)").font(.system(size: 15, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                        .frame(width: 36, height: 36).background(color, in: Circle())
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                        .background(Circle().fill(color.opacity(0.22)).frame(width: 46, height: 46))
                        .shadow(color: .black.opacity(0.25), radius: 5, y: 3)
                        .position(g.at)
                        .onTapGesture { tapGroup(g.items) }
                        .accessibilityLabel("\(g.items.count) places. Zoom in.")
                }
            }
        }
        .frame(width: size.width, height: size.height)
        .background(c("#c2e7ee", "#07202a"))
    }

    func pt(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: cam.x + x * cam.s, y: cam.y + y * cam.s) }

    func draw(_ ctx: inout GraphicsContext, z: CGFloat) {
        ctx.translateBy(x: cam.x, y: cam.y)
        ctx.scaleBy(x: cam.s, y: cam.s)
        let lw = 1 / cam.s
        var all = Self.land
        for i in Self.islands { all.addPath(i) }
        for k in Self.keys { all.addPath(k) }
        ctx.stroke(all, with: .color(c("#dff3f6", "#0b2a35")), lineWidth: 10 * lw)
        ctx.fill(all, with: .color(c("#f7f8f9", "#1d2024")))
        ctx.drawLayer { l in
            l.clip(to: all)
            let fills = ["forest": c("#d4ebcb", "#1c3021"), "wetland": c("#d2ece6", "#18302d"), "farm": c("#e4f0d2", "#252d20"), "city": c("#e8ebef", "#26292e")]
            for (p, kind) in Self.cover { l.fill(p, with: .color(fills[kind]!)) }
            if st.regions { for r in D.data.regions { l.fill(polygon(r.poly), with: .color(r.tint.opacity(dark ? 0.2 : 0.16))) } }
            for t in Self.towns { l.fill(Path(ellipseIn: t), with: .color(c("#e9ecef", "#26292e"))) }
            if z > 3 {
                var grid = Path()
                for (i, t) in Self.towns.enumerated() {
                    let step: CGFloat = [9, 8, 7, 6, 6][i]
                    var x = t.minX; while x <= t.maxX { grid.move(to: CGPoint(x: x, y: t.minY)); grid.addLine(to: CGPoint(x: x + t.height * 0.06, y: t.maxY)); x += step }
                    var y = t.minY; while y <= t.maxY { grid.move(to: CGPoint(x: t.minX, y: y)); grid.addLine(to: CGPoint(x: t.maxX, y: y - t.width * 0.03)); y += step }
                }
                var clipped = l
                clipped.clip(to: Path { p in for t in Self.towns { p.addEllipse(in: t) } })
                clipped.stroke(grid, with: .color(c("#ffffff", "#3a4047")), lineWidth: lw)
            }
        }
        ctx.stroke(Self.land, with: .color(c("#a9cfd8", "#2c3640")), lineWidth: 1.4 * lw)
        for l in D.data.map.lakes {
            let e = Path(ellipseIn: CGRect(x: l.cx - l.rx, y: l.cy - l.ry, width: l.rx * 2, height: l.ry * 2))
            ctx.fill(e, with: .color(c("#c2e7ee", "#07202a"))); ctx.stroke(e, with: .color(c("#a9cfd8", "#2c3640")), lineWidth: lw)
        }
        for r in Self.roads { ctx.stroke(r, with: .color(c("#dde3e8", "#2a2f35")), style: StrokeStyle(lineWidth: 5 * lw, lineCap: .round)) }
        for r in Self.roads { ctx.stroke(r, with: .color(c("#ffffff", "#3a4047")), style: StrokeStyle(lineWidth: 3 * lw, lineCap: .round)) }
    }

    struct Group { var at: CGPoint; var items: [Place]; var sel: Bool; var key: String { items.map(\.id).joined(separator: ",") } }
    func visible(_ p: Place) -> Bool {
        if p.id == selected { return true }
        if let h = hits { return h.contains(p.id) }
        if let f = filter { return p.cat == f }
        if st.hidden.contains(p.cat) { return false }
        if st.hideVisited && st.visited[p.id] != nil { return false }
        return p.cat != "people" && p.cat != "vehicle"
    }
    func makeGroups() -> [Group] {
        let list = D.pinned.filter(visible).sorted { (Self.priority.firstIndex(of: $0.cat) ?? 99) < (Self.priority.firstIndex(of: $1.cat) ?? 99) }
        var out: [Group] = []
        for p in list {
            let at = pt(p.point.x, p.point.y)
            if st.cluster && hits == nil && p.id != selected, let i = out.firstIndex(where: { !$0.sel && abs($0.at.x - at.x) < 30 && abs($0.at.y - at.y) < 30 }) {
                out[i].items.append(p)
            } else { out.append(Group(at: at, items: [p], sel: p.id == selected)) }
        }
        return out
    }
    @ViewBuilder func labels(_ groups: [Group], z: CGFloat) -> some View {
        let shown = labelPlacement(groups, z: z)
        ForEach(shown, id: \.0.id) { p, at in
            Text(p.name).font(.system(size: p.cat == "district" ? 13 : 12, weight: p.cat == "district" ? .bold : .semibold))
                .foregroundStyle(dark ? Color(hex: "#d1d1d6") : Color(hex: "#3a3a3c"))
                .shadow(color: dark ? .black.opacity(0.8) : .white, radius: 1.5).shadow(color: dark ? .black.opacity(0.8) : .white, radius: 3)
                .lineLimit(1).fixedSize()
                .frame(width: Self.labelWidth(p), alignment: .leading)
                .position(x: at.x + 21 + Self.labelWidth(p) / 2, y: at.y)
                .allowsHitTesting(false)
        }
    }
    static func labelWidth(_ p: Place) -> CGFloat { CGFloat(p.name.count) * (p.cat == "district" ? 7.8 : 7.2) + 6 }
    func labelPlacement(_ groups: [Group], z: CGFloat) -> [(Place, CGPoint)] {
        guard st.labels else { return [] }
        let pins = groups.map { CGRect(x: $0.at.x - 18, y: $0.at.y - 18, width: 36, height: 36) }
        var boxes: [CGRect] = [], out: [(Place, CGPoint)] = []
        let cands = groups.filter { $0.items.count == 1 }.map { ($0.items[0], $0.at) }
            .filter { p, _ in z > 2.2 || (p.cat == "district" && z > 1.35) || p.id == selected }
            .sorted { a, b in a.0.id == selected ? true : b.0.id == selected ? false : (Self.priority.firstIndex(of: a.0.cat) ?? 99) < (Self.priority.firstIndex(of: b.0.cat) ?? 99) }
        for (p, at) in cands {
            let w = Self.labelWidth(p)
            let box = CGRect(x: at.x + 20, y: at.y - 9, width: w, height: 18)
            let own = CGRect(x: at.x - 18, y: at.y - 18, width: 36, height: 36)
            if boxes.contains(where: { $0.intersects(box) }) || pins.contains(where: { $0 != own && $0.intersects(box) }) { continue }
            boxes.append(box); out.append((p, at))
        }
        return out
    }
}

struct PinView: View {
    let place: Place
    let selected: Bool
    let visited: Bool
    var letter: String? = nil
    var body: some View {
        let cat = D.cats[place.cat]!
        Group {
            if let letter {
                Text(letter).font(.system(size: 14, weight: .heavy)).foregroundStyle(.white).frame(width: 30, height: 30).background(cat.tint, in: Circle())
            } else {
                Badge(symbol: cat.symbol, color: cat.tint, size: 30)
            }
        }
            .overlay(Circle().stroke(.white, lineWidth: 2))
            .background(Circle().fill(cat.tint.opacity(selected ? 0.3 : 0)).frame(width: 48, height: 48))
            .overlay(alignment: .bottomTrailing) {
                if visited {
                    Image(systemName: "checkmark").font(.system(size: 7, weight: .black)).foregroundStyle(.white)
                        .frame(width: 13, height: 13).background(Color.green, in: Circle()).overlay(Circle().stroke(.white, lineWidth: 1.5)).offset(x: 3, y: 3)
                }
            }
            .shadow(color: .black.opacity(0.28), radius: 4, y: 3)
            .scaleEffect(selected ? 1.4 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: selected)
            .frame(width: 48, height: 48)
            .contentShape(Circle())
    }
}

struct MyPinView: View {
    let selected: Bool
    var body: some View {
        Image(systemName: "mappin").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
            .frame(width: 30, height: 30)
            .background(UnevenRoundedRectangle(topLeadingRadius: 15, bottomLeadingRadius: 3, bottomTrailingRadius: 15, topTrailingRadius: 15).fill(Color.pink).rotationEffect(.degrees(-45)))
            .shadow(color: .black.opacity(0.28), radius: 4, y: 3)
            .scaleEffect(selected ? 1.4 : 1).animation(.spring(response: 0.3, dampingFraction: 0.6), value: selected)
            .frame(width: 48, height: 48).contentShape(Rectangle())
    }
}

struct Chips: View {
    @EnvironmentObject var model: MapModel
    static let ids = ["safehouse", "store", "business", "activity", "landmark", "race", "nature", "waink", "weapons", "transport", "vehicle", "people"]
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(nil, "All", nil, nil)
                ForEach(Self.ids.compactMap { D.cats[$0] }) { c in chip(c.id, c.shortName, c.symbol, c.tint) }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
        }
    }
    func chip(_ id: String?, _ title: String, _ symbol: String?, _ color: Color?) -> some View {
        let on = model.filter == id
        return Button {
            model.filter = (on && id != nil) ? nil : id
            if let f = model.filter { model.zoomTo(D.pinned.filter { $0.cat == f }) }
        } label: {
            HStack(spacing: 6) {
                if let symbol { Image(systemName: symbol).font(.system(size: 14, weight: .semibold)).foregroundStyle(on ? .white : (color ?? .primary)) }
                Text(title).font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(on ? (id == nil ? Color(uiColor: .systemBackground) : .white) : .primary)
            .padding(.horizontal, 16).frame(height: 44)
            .background { if on { Capsule().fill(color ?? .primary) } }
            .glass(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct Controls: View {
    @EnvironmentObject var model: MapModel
    var body: some View {
        VStack(spacing: 0) {
            Button { model.filter = nil; model.open(.layers) } label: {
                Image(systemName: "square.3.layers.3d").font(.system(size: 17, weight: .semibold)).frame(width: 48, height: 48)
            }
            .accessibilityLabel("Layers: choose what shows on the map")
            Divider().frame(width: 28)
            Button { model.go(model.fit()) } label: {
                Image(systemName: "arrow.up.left.and.arrow.down.right").font(.system(size: 17, weight: .semibold)).frame(width: 48, height: 48)
            }
            .accessibilityLabel("Show all of Leonida")
        }
        .buttonStyle(.plain)
        .glass(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}
