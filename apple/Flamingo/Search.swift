import Foundation

// A port of web/app/search.js. Same normalising and the same ranking, so a query finds the same things on every app.
enum Search {
    static func norm(_ s: String?) -> String {
        guard var t = s?.lowercased() else { return "" }
        t = t.folding(options: .diacriticInsensitive, locale: nil)
        t = t.replacingOccurrences(of: "['’`]", with: "", options: .regularExpression)
        t = t.replacingOccurrences(of: "[^a-z0-9$]+", with: " ", options: .regularExpression)
        return t.trimmingCharacters(in: .whitespaces)
    }
    static func score(_ text: String?, _ q: String) -> Double {
        let t = norm(text)
        if t.isEmpty || q.isEmpty { return 0 }
        if t == q { return 100 }
        if t.hasPrefix(q) { return 80 }
        if (" " + t).contains(" " + q) { return 60 }
        if t.contains(q) { return 40 }
        let words = q.split(separator: " "), tw = t.split(separator: " ")
        if words.count > 1 && words.allSatisfy({ w in tw.contains { $0.hasPrefix(w) } }) { return 30 }
        return 0
    }
    enum Hit: Hashable { case place(Place), region(Region), mission(Mission), collectible(Collectible) }
    static func run(_ query: String, spoilers: Bool, limit: Int = 60) -> [Hit] {
        let q = norm(query)
        if q.isEmpty { return [] }
        var out: [(Hit, Double, String)] = []
        for p in D.data.places {
            var s = score(p.name, q)
            if s == 0 { s = max(score(D.cats[p.cat]?.one, q), score(D.cats[p.cat]?.name, q)) * 0.5 }
            if s == 0 { s = score(p.region.flatMap { D.regions[$0]?.name }, q) * 0.4 }
            if s == 0 { s = score(p.note, q) * 0.3 }
            if s > 0 { out.append((.place(p), s + (p.pinned ? 1 : 0) + (p.cat == "district" ? 2 : 0), p.name)) }
        }
        for r in D.data.regions {
            let s = max(score(r.name, q), score(r.short, q))
            if s > 0 { out.append((.region(r), s + 5, r.name)) }
        }
        for m in D.data.missions {
            var s = spoilers && m.name != nil ? score(m.name, q) : 0
            if s == 0 { s = score("chapter \(m.chapter) mission \(m.n)", q) * 0.6 }
            if s == 0 && spoilers { s = score(m.chapterTitle, q) * 0.3 }
            if s > 0 { out.append((.mission(m), s, m.name ?? "")) }
        }
        for c in D.data.collectibles {
            let s = score(c.name, q)
            if s > 0 { out.append((.collectible(c), s, c.name)) }
        }
        return out.sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.2 < $1.2 }.prefix(limit).map(\.0)
    }
}
