import AuthenticationServices
import CryptoKit
import Security
import SwiftUI

typealias Fields = [String: Any]
let serviceOrigin = URL(string: "https://find-a-flatmate.anchit-tandon.com")!

func base64url(_ bytes: Data) -> String {
    bytes.base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

enum Keychain {
    static let key: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "com.findaflatmate.app",
        kSecAttrAccount as String: "native-session"
    ]
    static func read() -> String? {
        var query = key
        query[kSecReturnData as String] = true
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func write(_ token: String?) {
        SecItemDelete(key as CFDictionary)
        guard let token else { return }
        var item = key
        item[kSecValueData as String] = Data(token.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }
}

struct NativeError: LocalizedError {
    let message: String
    let status: Int
    var errorDescription: String? { message }
}

@MainActor
final class NativeAPI: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published private(set) var signedIn = Keychain.read() != nil
    private var token = Keychain.read()
    private var auth: ASWebAuthenticationSession?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }

    func authenticate() async throws {
        var bytes = Data(count: 32)
        let status = bytes.withUnsafeMutableBytes { buffer in
            SecRandomCopyBytes(kSecRandomDefault, 32, buffer.baseAddress!)
        }
        guard status == errSecSuccess else { throw NativeError(message: "Could not start sign-in.", status: 0) }
        let verifier = base64url(bytes)
        let challenge = base64url(Data(SHA256.hash(data: Data(verifier.utf8))))
        let url = URL(string: "/mobile/authorize?challenge=\(challenge)", relativeTo: serviceOrigin)!.absoluteURL
        let callback: URL = try await withCheckedThrowingContinuation { continuation in
            let flow = ASWebAuthenticationSession(url: url, callbackURLScheme: "findaflatmate") { url, error in
                if let url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: error ?? NativeError(message: "Sign-in cancelled.", status: 0)) }
            }
            auth = flow
            flow.presentationContextProvider = self
            flow.prefersEphemeralWebBrowserSession = true
            if !flow.start() { continuation.resume(throwing: NativeError(message: "Could not open sign-in.", status: 0)) }
        }
        guard callback.host == "auth",
              let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "code" })?.value else {
            throw NativeError(message: "Sign-in could not finish.", status: 0)
        }
        var request = request(path: "/api/mobile/session", method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "verifier": verifier])
        let body = try await send(request)
        guard let token = body["token"] as? String else {
            throw NativeError(message: "Sign-in could not finish.", status: 0)
        }
        self.token = token
        Keychain.write(token)
        signedIn = true
    }

    func signOut() async throws {
        _ = try await send(request(path: "/api/mobile/session", method: "DELETE"))
        clear()
    }
    func clear() {
        token = nil
        Keychain.write(nil)
        signedIn = false
    }

    func photo(_ id: String) async throws -> UIImage? {
        let (data, response) = try await URLSession.shared.data(for: request(path: "/api/media/" + id))
        return (response as? HTTPURLResponse)?.statusCode == 200 ? UIImage(data: data) : nil
    }

    func view(_ name: String, id: String? = nil) async throws -> Fields {
        var path = "/api/mobile/data?view=\(name)"
        if let id { path += "&id=\(id)" }
        return try await send(request(path: path))
    }

    func mutate(_ operation: String, _ fields: [String: String], photo: Data? = nil, repeats: [String:[String]] = [:]) async throws -> Fields {
        let boundary = UUID().uuidString
        var request = request(path: "/api/mobile/data?op=\(operation)", method: "POST")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var data = Data()
        let entries = Array(fields.map { ($0.key,$0.value) }) + repeats.flatMap { key, values in values.map { (key,$0) } }
        for (key, value) in entries {
            data.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n".utf8))
        }
        if let photo {
            data.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"room.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
            data.append(photo)
            data.append(Data("\r\n".utf8))
        }
        data.append(Data("--\(boundary)--\r\n".utf8))
        request.httpBody = data
        return try await send(request)
    }

    private func request(path: String, method: String = "GET") -> URLRequest {
        var request = URLRequest(url: URL(string: path, relativeTo: serviceOrigin)!.absoluteURL)
        request.httpMethod = method
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return request
    }

    private func send(_ request: URLRequest) async throws -> Fields {
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let body = (try? JSONSerialization.jsonObject(with: data)) as? Fields ?? [:]
        if status == 401 && request.url?.path == "/api/mobile/data" { clear() }
        guard (200..<300).contains(status) else {
            throw NativeError(message: body["error"] as? String ?? "Could not complete this request. Try again.", status: status)
        }
        return body
    }
}

extension Dictionary where Key == String, Value == Any {
    func text(_ key: String) -> String { self[key] as? String ?? "" }
    func rows(_ key: String = "items") -> [Fields] { self[key] as? [Fields] ?? [] }
    func integer(_ key: String) -> Int { (self[key] as? NSNumber)?.intValue ?? 0 }
}
