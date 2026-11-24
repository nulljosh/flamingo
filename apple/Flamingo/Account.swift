import SwiftUI
import Security

// Accounts and progress sync, the same as the web app: email sign-in at api.jaybulb.com, one owner-only row per account
// in `flamingo_progress`. The rules match web/app/sync.js: the first link unions both sides, then the newer side wins.
enum Sync {
    struct Progress: Equatable { var visited: [String: Double]; var done: [String: Double]; var found: [String: Int]; var savePct: String; var fav: [String: Double] = [:]; var pins: [Store.MyPin] = [] }
    static func union(_ a: Progress, _ b: Progress) -> Progress {
        var v = a.visited; for (k, t) in b.visited { v[k] = v[k].map { min($0, t) } ?? t }
        var d = a.done; for (k, t) in b.done { d[k] = d[k].map { min($0, t) } ?? t }
        var f = a.found; for (k, n) in b.found { f[k] = max(f[k] ?? 0, n) }
        var fv = a.fav; for (k, t) in b.fav { fv[k] = fv[k].map { min($0, t) } ?? t }
        let pins = a.pins + b.pins.filter { p in !a.pins.contains { $0.id == p.id } }   // same pin on both: this side's edit wins
        return Progress(visited: v, done: d, found: f, savePct: a.savePct.isEmpty ? b.savePct : a.savePct, fav: fv, pins: pins)
    }
    enum Take { case local, remote, union }
    static func reconcile(local: Progress, linked: Bool, dirty: Bool, remote: Progress?) -> (Take, Progress, Bool) {
        guard let remote else { return (.local, local, true) }
        if !linked { return (.union, union(local, remote), true) }
        if dirty { return (.local, local, true) }
        return (.remote, remote, false)
    }
}

@MainActor
final class Account: ObservableObject {
    @Published var email: String?
    @Published var syncedAt: Date?
    @Published var busy = false
    @Published var message: String?
    private(set) var api = URL(string: "https://api.jaybulb.com")!
    private var session: Session? { didSet { saveSession() } }
    weak var store: Store?
    private var pushTask: Task<Void, Never>?

    struct Session: Codable { var access_token: String; var refresh_token: String; var user: User }
    struct User: Codable { var id: String; var email: String? }
    struct Row: Codable { var id: String; var visited: [String: Double]?; var done: [String: Double]?; var found: [String: Int]?; var save_pct: String?; var fav: [String: Double]?; var pins: [Store.MyPin]? }

    init() {
        let a = ProcessInfo.processInfo.arguments
        // QA: -qaAPI http://localhost:8787 points at a local API; any other host is ignored
        if let i = a.firstIndex(of: "-qaAPI"), a.indices.contains(i + 1), let u = URL(string: a[i + 1]), ["localhost", "127.0.0.1"].contains(u.host ?? "") { api = u }
        if let d = Keychain.read(key), let s = try? JSONDecoder().decode(Session.self, from: d) { session = s; email = s.user.email }
    }
    private let key = "flamingo.session"
    private func saveSession() {
        if let s = session, let d = try? JSONEncoder().encode(s) { Keychain.write(key, d) } else { Keychain.delete(key) }
    }

    // ---- auth ----
    func signIn(_ email: String, _ password: String) async {
        busy = true; defer { busy = false }
        do {
            let s: Session = try await call("POST", "/auth/token?grant_type=password", body: ["email": email, "password": password], authed: false)
            session = s; self.email = s.user.email ?? email; message = nil
            await pull()
        } catch { message = error.localizedDescription }
    }
    func signUp(_ email: String, _ password: String) async {
        busy = true; defer { busy = false }
        do {
            let _: Empty = try await call("POST", "/auth/signup", body: ["email": email, "password": password, "redirect_to": "https://flamingo.jaybulb.com/app/#settings"], authed: false)
            message = "Check your email to confirm, then sign in here."
        } catch { message = error.localizedDescription }
    }
    func reset(_ email: String) async {
        _ = try? await call("POST", "/auth/recover", body: ["email": email, "redirect_to": "https://flamingo.jaybulb.com/app/#settings"], authed: false) as Empty
        message = "If that email has an account, a reset link is on its way."
    }
    func signOut() async {
        _ = try? await call("POST", "/auth/logout", body: [String: String](), authed: true) as Empty
        session = nil; email = nil; syncedAt = nil; store?.s.linked = false; store?.s.dirty = false
        message = "Signed out. Your progress stays on this device."
    }
    func deleteAccount() async {
        do {
            let _: Empty = try await call("DELETE", "/auth/user", body: nil as [String: String]?, authed: true)
            session = nil; email = nil; syncedAt = nil; store?.s.linked = false; store?.s.dirty = false
            message = "Account deleted. Your progress stays on this device."
        } catch { message = error.localizedDescription }
    }

    // ---- sync ----
    var local: Sync.Progress {
        let s = store?.s ?? Store.State()
        return .init(visited: s.visited, done: s.done, found: s.found, savePct: s.savePct ?? "", fav: s.fav ?? [:], pins: s.pins ?? [])
    }
    func progressChanged() {
        guard session != nil else { return }
        store?.s.dirty = true
        pushTask?.cancel()
        pushTask = Task { try? await Task.sleep(nanoseconds: 1_500_000_000); if !Task.isCancelled { await push() } }
    }
    func push() async {
        guard let s = session, let st = store else { return }
        let p = local
        let row = Row(id: s.user.id, visited: p.visited, done: p.done, found: p.found, save_pct: p.savePct.isEmpty ? nil : p.savePct, fav: p.fav, pins: p.pins)
        do {
            let _: Empty = try await call("POST", "/rest/flamingo_progress?on_conflict=id", body: row, authed: true, prefer: "resolution=merge-duplicates")
            st.s.dirty = false; st.s.linked = true; syncedAt = Date()
        } catch { message = "Couldn't sync: \(error.localizedDescription)" }
    }
    func pull() async {
        guard session != nil, let st = store else { return }
        do {
            let rows: [Row] = try await call("GET", "/rest/flamingo_progress", body: nil as [String: String]?, authed: true)
            let remote = rows.first.map { Sync.Progress(visited: $0.visited ?? [:], done: $0.done ?? [:], found: $0.found ?? [:], savePct: $0.save_pct ?? "", fav: $0.fav ?? [:], pins: $0.pins ?? []) }
            let (_, p, needPush) = Sync.reconcile(local: local, linked: st.s.linked ?? false, dirty: st.s.dirty ?? false, remote: remote)
            st.applyRemote(p)
            if needPush { await push() } else { st.s.linked = true; syncedAt = Date() }
        } catch { message = "Couldn't sync: \(error.localizedDescription)" }
    }

    // ---- http ----
    struct Empty: Decodable { init() {}; init(from: Decoder) {} }
    struct APIError: LocalizedError { let errorDescription: String? }
    private func call<B: Encodable, R: Decodable>(_ method: String, _ path: String, body: B?, authed: Bool, prefer: String? = nil, retried: Bool = false) async throws -> R {
        var req = URLRequest(url: URL(string: path, relativeTo: api)!)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("https://flamingo.jaybulb.com", forHTTPHeaderField: "Origin")
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if authed, let t = session?.access_token { req.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization") }
        if let body { req.httpBody = try JSONEncoder().encode(body) }
        let (data, res) = try await URLSession.shared.data(for: req)
        let code = (res as? HTTPURLResponse)?.statusCode ?? 0
        if code == 401, authed, !retried, let r = session?.refresh_token {   // expired access token: refresh once and retry
            let s: Session = try await call("POST", "/auth/token?grant_type=refresh_token", body: ["refresh_token": r], authed: false)
            session = s
            return try await call(method, path, body: body, authed: authed, prefer: prefer, retried: true)
        }
        if code >= 300 {
            if code == 401 && authed { session = nil; email = nil }
            let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError(errorDescription: msg ?? "Request failed (\(code))")
        }
        if R.self == Empty.self || data.isEmpty { return Empty() as! R }
        return try JSONDecoder().decode(R.self, from: data)
    }
}

enum Keychain {
    static func base(_ k: String) -> [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.nulljosh.flamingo", kSecAttrAccount as String: k] }
    static func read(_ k: String) -> Data? {
        var q = base(k); q[kSecReturnData as String] = true; var out: AnyObject?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }
    static func write(_ k: String, _ d: Data) {
        delete(k); var q = base(k); q[kSecValueData as String] = d; q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(q as CFDictionary, nil)
    }
    static func delete(_ k: String) { SecItemDelete(base(k) as CFDictionary) }
}

// The Account section in Settings, and its sign-in sheet.
struct AccountSection: View {
    @EnvironmentObject var account: Account
    @State private var showForm = false
    @State private var confirmDelete = false
    var body: some View {
        Section {
            if let email = account.email {
                HStack(spacing: 12) {
                    Badge(symbol: "person.fill", color: .pink)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(email).lineLimit(1)
                        Text(account.syncedAt.map { "Synced \($0.formatted(.relative(presentation: .named)))" } ?? "Signed in").font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                Button("Sync now") { Task { await account.pull() } }
                Button("Sign out") { Task { await account.signOut() } }
                Button("Delete account", role: .destructive) { confirmDelete = true }
                    .confirmationDialog("Delete your account?", isPresented: $confirmDelete, titleVisibility: .visible) {
                        Button("Delete account", role: .destructive) { Task { await account.deleteAccount() } }
                    } message: { Text("Your synced progress is deleted. This device keeps its own copy.") }
            } else {
                Button { showForm = true } label: {
                    HStack(spacing: 12) {
                        Badge(symbol: "person.fill", color: .pink)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Sign in or create an account").foregroundStyle(.primary)
                            Text("Keep your progress on every device").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        } header: { Text("Account") } footer: { if let m = account.message { Text(m) } }
        .sheet(isPresented: $showForm) { AccountForm().presentationDetents([.medium]) }
    }
}

struct AccountForm: View {
    @EnvironmentObject var account: Account
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(.password)
                } footer: { if let m = account.message { Text(m) } }
                Section {
                    Button { Task { await account.signIn(email, password); if account.email != nil { dismiss() } } } label: { Text("Sign in").bold().frame(maxWidth: .infinity) }
                    Button { Task { await account.signUp(email, password) } } label: { Text("Create account").frame(maxWidth: .infinity) }
                    Button("Forgot password?") { Task { await account.reset(email) } }.font(.subheadline)
                }
                .disabled(account.busy || email.isEmpty)
            }
            .navigationTitle("Account").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
