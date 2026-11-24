import SwiftUI

// Liquid Glass on iOS 26 and macOS 26; a material with a bright rim and a soft shadow on earlier systems.
extension View {
    @ViewBuilder func glass<S: Shape>(_ shape: S, interactive: Bool = true) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26, macOS 26, *) {
            self.glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            fallbackGlass(shape)
        }
        #else
        fallbackGlass(shape)
        #endif
    }
    func fallbackGlass<S: Shape>(_ shape: S) -> some View {
        self.background(.regularMaterial, in: shape)
            .overlay(shape.stroke(LinearGradient(colors: [.white.opacity(0.55), .white.opacity(0.08)], startPoint: .top, endPoint: .bottom), lineWidth: 0.75))
            .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
    }
}

// A round icon in a category colour, as on the pins.
struct Badge: View {
    let symbol: String
    let color: Color
    var size: CGFloat = 32
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.46, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(color, in: Circle())
    }
}

// Catmull-Rom smoothing, the same curve the web app draws.
func smoothPath(_ pts: [[Double]], closed: Bool = true, t: Double = 0.5) -> Path {
    var p = Path()
    let n = pts.count
    guard n > 1 else { return p }
    func P(_ i: Int) -> CGPoint {
        let k = closed ? ((i % n) + n) % n : max(0, min(n - 1, i))
        return CGPoint(x: pts[k][0], y: pts[k][1])
    }
    p.move(to: P(0))
    for i in 0..<(closed ? n : n - 1) {
        let p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
        let c1 = CGPoint(x: p1.x + (p2.x - p0.x) * t / 3, y: p1.y + (p2.y - p0.y) * t / 3)
        let c2 = CGPoint(x: p2.x - (p3.x - p1.x) * t / 3, y: p2.y - (p3.y - p1.y) * t / 3)
        p.addCurve(to: p2, control1: c1, control2: c2)
    }
    if closed { p.closeSubpath() }
    return p
}

func polygon(_ pts: [[Double]]) -> Path {
    var p = Path()
    guard let f = pts.first else { return p }
    p.move(to: CGPoint(x: f[0], y: f[1]))
    for q in pts.dropFirst() { p.addLine(to: CGPoint(x: q[0], y: q[1])) }
    p.closeSubpath()
    return p
}
