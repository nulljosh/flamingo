import SwiftUI

// A port of web/app/route.js: the shortest open path through a set of pins. Nearest neighbour from every start, then 2-opt.
enum Trip {
    static func length(_ pts: [CGPoint]) -> Double {
        zip(pts, pts.dropFirst()).reduce(0) { $0 + hypot($1.0.x - $1.1.x, $1.0.y - $1.1.y) }
    }
    static func order(_ pts: [CGPoint]) -> [Int] {
        let n = pts.count
        if n < 3 { return Array(0..<n) }
        func d(_ a: Int, _ b: Int) -> Double { hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y) }
        var best: [Int] = [], bestLen = Double.infinity
        for s in 0..<n {
            var left = Array(0..<n).filter { $0 != s }, out = [s]
            while !left.isEmpty {
                let last = out.last!
                let k = left.indices.min { d(last, left[$0]) < d(last, left[$1]) }!
                out.append(left.remove(at: k))
            }
            let len = zip(out, out.dropFirst()).reduce(0) { $0 + d($1.0, $1.1) }
            if len < bestLen { best = out; bestLen = len }
        }
        var o = best, better = true
        while better {
            better = false
            for i in 0..<(n - 1) {
                for j in (i + 1)..<n {
                    let before = (i > 0 ? d(o[i - 1], o[i]) : 0) + (j < n - 1 ? d(o[j], o[j + 1]) : 0)
                    let after = (i > 0 ? d(o[i - 1], o[j]) : 0) + (j < n - 1 ? d(o[i], o[j + 1]) : 0)
                    if after < before - 1e-9 { o.replaceSubrange(i...j, with: o[i...j].reversed()); better = true }
                }
            }
        }
        return o
    }
    // the run through what is left in a region: unvisited pins you can see, in route order
    static func stops(_ region: String, _ s: Store.State) -> [Place] {
        let ps = D.pinned.filter { $0.region == region && $0.cat != "people" && $0.cat != "vehicle" && s.visited[$0.id] == nil && !s.hidden.contains($0.cat) }
        return order(ps.map(\.point)).map { ps[$0] }
    }
}

struct TripScreen: View {
    let region: Region
    @EnvironmentObject var store: Store
    @EnvironmentObject var model: MapModel
    var body: some View {
        let stops = Trip.stops(region.id, store.s)
        let km = Trip.length(stops.map(\.point)) * (D.data.metresPerUnit ?? 15) / 1000
        List {
            Section {
                VStack(alignment: .leading, spacing: 14) {
                    Header(symbol: "point.topleft.down.to.point.bottomright.curvepath.fill", color: region.tint, title: "Route through \(region.short)",
                           sub: "\(stops.count) stops · about \(km < 10 ? String(format: "%.1f", km) : String(Int(km.rounded()))) km")
                    Text("The shortest order through every place you haven't visited, as the crow flies. Tick places off as you go and plan again.")
                }
                .listRowBackground(Color.clear).listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
            Section { ForEach(Array(stops.enumerated()), id: \.element.id) { i, p in PlaceRow(p: p, letter: String(i + 1)) } }
        }
        .listStyle(.insetGrouped).scrollContentBackground(.hidden)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { CloseButton() } }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { model.selected = nil; model.trip = stops.map(\.id); model.zoomTo(stops) }
        .onDisappear { model.trip = nil }
    }
}
