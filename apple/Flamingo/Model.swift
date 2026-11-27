import SwiftUI

// The same data file the web app reads (web/data/leonida.json, built by scripts/build-data.mjs).
struct Leonida: Decodable {
    let version: Int
    let updated: String
    let size: [Double]
    let disclaimer: String
    let map: Geo
    let regions: [Region]
    let categories: [Category]
    let places: [Place]
    let missions: [Mission]
    let collectibles: [Collectible]

    struct Geo: Decodable {
        let land: [[Double]]
        let islands: [Island]
        let keys: [[Double]]
        let lakes: [Lake]
        let roads: [Road]
        let towns: [[Double]]   // built-up areas: cx, cy, rx, ry, street spacing
        let streets: [[[Double]]]   // traced street lines
    }
    struct Island: Decodable { let id: String; let pts: [[Double]] }
    struct Lake: Decodable { let id: String; let pts: [[Double]] }
    struct Road: Decodable { let id: String; let name: String; let pts: [[Double]] }

    static let shared: Leonida = {
        guard let url = Bundle.main.url(forResource: "leonida", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let d = try? JSONDecoder().decode(Leonida.self, from: data) else { fatalError("leonida.json missing from the bundle") }
        return d
    }()

    lazy var placeByID: [String: Place] = Dictionary(uniqueKeysWithValues: places.map { ($0.id, $0) })
}

struct Region: Decodable, Identifiable, Hashable {
    let id, name, short, color, blurb, inspiration: String
    let label: [Double]
    let poly: [[Double]]
    var tint: Color { Color(hex: color) }
}

struct Category: Decodable, Identifiable, Hashable {
    let id, name, one, color, symbol: String
    var tint: Color { Color(hex: color) }
    var shortName: String { String(name.split(separator: "&")[0].split(separator: ",")[0]).trimmingCharacters(in: .whitespaces) }
}

struct Place: Decodable, Identifiable, Hashable {
    let id, name, cat, tag, note: String
    let region: String?
    let x, y: Double?
    let at: String?
    var pinned: Bool { x != nil }
    var point: CGPoint { CGPoint(x: x ?? 0, y: y ?? 0) }
}

struct Mission: Decodable, Identifiable, Hashable {
    let id, chapterTitle: String
    let chapter, n: Int
    let name: String?
    let who: [String]
    let heist: Bool
    let at: String?
}

struct Collectible: Decodable, Identifiable, Hashable {
    let id, name, note: String
    let total: Int
}

enum D {
    static let data = Leonida.shared
    static let cats: [String: Category] = Dictionary(uniqueKeysWithValues: data.categories.map { ($0.id, $0) })
    static let regions: [String: Region] = Dictionary(uniqueKeysWithValues: data.regions.map { ($0.id, $0) })
    static let places: [String: Place] = Dictionary(uniqueKeysWithValues: data.places.map { ($0.id, $0) })
    static let missions: [String: Mission] = Dictionary(uniqueKeysWithValues: data.missions.map { ($0.id, $0) })
    static let collectibles: [String: Collectible] = Dictionary(uniqueKeysWithValues: data.collectibles.map { ($0.id, $0) })
    static let pinned = data.places.filter { $0.pinned }
    static func where_(_ p: Place) -> String { "\(cats[p.cat]?.one ?? "") · \(p.region.flatMap { regions[$0]?.name } ?? "Location not known yet")" }
}

extension Color {
    init(hex: String) {
        var v: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
        self.init(.sRGB, red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
    static let pink = Color(hex: "#ff3d8b")
}
