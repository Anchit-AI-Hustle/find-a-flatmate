import PhotosUI
import SwiftUI

private let forest = Color(red: 0.03, green: 0.36, blue: 0.29)
private let ivory = Color(red: 0.99, green: 0.98, blue: 0.96)

@main
struct FindAFlatmate: App {
    @StateObject private var api = NativeAPI()
    var body: some Scene {
        WindowGroup {
            Group {
                if api.signedIn { Workspace() }
                else { Welcome() }
            }.environmentObject(api).tint(forest)
        }
    }
}

struct Welcome: View {
    @EnvironmentObject private var api: NativeAPI
    @State private var busy = false
    @State private var notice = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Label("find a flatmate.", systemImage: "house.fill").font(.headline).foregroundStyle(forest)
                    Text("Find someone you can actually live with.")
                        .font(.system(size: 42, weight: .bold, design: .serif))
                        .accessibilityAddTraits(.isHeader)
                    Text("Compare everyday habits and real housing costs in Gurugram and Noida.")
                        .foregroundStyle(.secondary)
                    Image("Hero").resizable().scaledToFit().clipShape(.rect(cornerRadius: 24))
                        .accessibilityHidden(true)
                    Button {
                        busy = true
                        Task {
                            defer { busy = false }
                            do { try await api.authenticate() }
                            catch { notice = error.localizedDescription }
                        }
                    } label: {
                        Text(busy ? "Opening sign-in…" : "Sign in or create an account")
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }.buttonStyle(.borderedProminent).disabled(busy)
                    Text("Continue with Google or an email link. For adults 18 and over.")
                        .font(.footnote).foregroundStyle(.secondary)
                    NavigationLink("Try matching with examples") { Feed(title: "Practice matching", mode: "samples") }
                    if !notice.isEmpty { Text(notice).foregroundStyle(.red) }
                }.padding(24)
            }.background(ivory)
        }
    }
}

struct Workspace: View {
    var body: some View {
        TabView {
            NavigationStack { Feed(title: "Discover", mode: "people") }
                .tabItem { Label("Discover", systemImage: "sparkle.magnifyingglass") }
            NavigationStack { Feed(title: "Messages", mode: "messages") }
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right") }
            NavigationStack { Feed(title: "Visits", mode: "visits") }
                .tabItem { Label("Visits", systemImage: "calendar") }
            NavigationStack { Account() }
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}

struct Feed: View {
    @EnvironmentObject private var api: NativeAPI
    let title: String
    let mode: String
    @State private var selection = "people"
    @State private var items: [Fields] = []
    @State private var issue = ""
    @State private var loading = true
    @State private var notification = ""
    var view: String { mode == "people" ? selection : mode }

    var body: some View {
        List {
            if mode == "people" {
                Picker("Discover", selection: $selection) {
                    Text("People").tag("people")
                    Text("Rooms").tag("rooms")
                }.pickerStyle(.segmented)
            }
            if mode == "samples" { Text("Fictional profiles and rooms. The real matching rules explain these examples.").foregroundStyle(.secondary) }
            if loading { ProgressView() }
            if !issue.isEmpty { Text(issue).foregroundStyle(.red) }
            if !notification.isEmpty { Text(notification).foregroundStyle(forest) }
            if !loading && issue.isEmpty && items.isEmpty { Text("Nothing here yet. Pull to refresh.").foregroundStyle(.secondary) }
            ForEach(Array(items.enumerated()), id: \.offset) { _, row in
                if mode == "messages" {
                    NavigationLink {
                        Thread(row: row)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(row.text("display_name")).font(.headline)
                            if row.integer("unread") > 0 { Text("\(row.integer("unread")) unread").font(.caption) }
                        }
                    }
                } else if mode == "visits" {
                    VisitRow(row: row, onChange: load)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(row.text("title").isEmpty ? row.text("display_name") : row.text("title")).font(.headline)
                        if mode == "samples" { Text(row.text("blurb")).foregroundStyle(.secondary) }
                        if mode == "listings" {
                            Text(row.text("status").replacingOccurrences(of: "_", with: " ")).foregroundStyle(.secondary)
                            NavigationLink("Manage room") { ListingEditor(row: row) }
                        }
                        if mode == "connections" {
                            Button("Accept interest") { change("interest", ["target":row.text("id"),"action":"like"]) }
                        }
                        if view == "rooms" {
                            Text("₹\(row.integer("monthly") / 100) monthly")
                            if row["utilities"] is NSNull { Text("Utilities are unknown.").font(.footnote) }
                            Text("Deposit: ₹\(row.integer("deposit") / 100)").font(.footnote)
                            if let media = row.rows("listing_images").first {
                                RoomPhoto(id: media.text("id"))
                            }
                        }
                        if let fit = row["fit"] as? Fields {
                            DisclosureGroup("Compatibility") {
                                Text(fit["score"] is NSNull ? "More information needed" : "\(fit.integer("score")) / 100")
                                ForEach((fit["top_reasons"] as? [String] ?? []) + (fit["potential_friction"] as? [String] ?? []), id: \.self) { reason in
                                    Text(reason)
                                }
                            }
                        }
                        if view == "rooms" || view == "people" {
                            let target = view == "rooms" ? row.text("owner_id") : row.text("id")
                            HStack {
                                Button("Like") {
                                    var fields = ["target":target,"action":"like"]
                                    if view == "rooms" { fields["listing"] = row.text("id") }
                                    change("interest", fields)
                                }.buttonStyle(.borderedProminent)
                                Button("Save") {
                                    change("save", ["target":row.text("id"),"kind":view == "rooms" ? "listing" : "profile","enabled":"yes"])
                                }.buttonStyle(.bordered)
                                Button("Pass") { change("interest", ["target":target,"action":"pass"]) }.buttonStyle(.bordered)
                            }
                            NavigationLink("Report or block") {
                                SafetyForm(target: target, listing: view == "rooms" ? row.text("id") : nil)
                            }
                        }
                        if mode == "saved" {
                            Button("Remove saved item") { change("save", ["target":row.text("id"),"kind":row.text("kind"),"enabled":"no"]) }
                        }
                    }.padding(.vertical, 6)
                }
            }
        }
        .navigationTitle(title)
        .toolbar {
            if mode == "listings" { NavigationLink("Add room") { ListingEditor(row: [:]) } }
        }
        .task(id: view) { await load() }
        .refreshable { await load() }
    }

    @MainActor private func load() async {
        loading = true
        defer { loading = false }
        do {
            let result = try await api.view(view)
            items = view == "samples" ? result.rows("people") + result.rows("rooms") : result.rows()
            issue = ""
        } catch {
            issue = error.localizedDescription
        }
    }

    private func change(_ op: String, _ values: [String:String]) {
        Task {
            do {
                let result = try await api.mutate(op, values)
                notification = result.text("success")
                await load()
            } catch { issue = error.localizedDescription }
        }
    }
}

struct RoomPhoto: View {
    @EnvironmentObject private var api: NativeAPI
    let id: String
    @State private var image: UIImage?
    var body: some View {
        Group {
            if let image {
                Image(uiImage: image).resizable().scaledToFit()
                    .clipShape(.rect(cornerRadius: 12)).accessibilityLabel("Room photo")
            }
        }.task(id: id) { image = try? await api.photo(id) }
    }
}

struct Thread: View {
    @EnvironmentObject private var api: NativeAPI
    let row: Fields
    @State private var messages: [Fields] = []
    @State private var member = ""
    @State private var draft = ""
    @State private var issue = ""
    @State private var visitDate = Date().addingTimeInterval(86_400)
    var body: some View {
        List {
            Section("Conversation") {
                ForEach(messages, id: \.description) { message in
                    VStack(alignment: .leading) {
                        Text(message.text("sender_id") == member ? "You" : row.text("display_name")).font(.caption)
                        Text(message.text("body"))
                        if message["suspicious"] as? Bool == true {
                            Text("Check payment or personal information requests before acting.").font(.caption).foregroundStyle(.red)
                        }
                        if message.text("sender_id") != member {
                            NavigationLink("Report message") { SafetyForm(target:row.text("other_id"), message:message.text("id")) }
                        }
                    }
                }
                TextField("Write a message", text: $draft, axis: .vertical)
                Button("Send") { send("message", ["c":row.text("id"),"body":draft,"request_key":UUID().uuidString]) }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            Section("Plan a visit") {
                DatePicker("Date and time (IST)", selection: $visitDate, in: Date()...)
                    .environment(\.timeZone, TimeZone(identifier: "Asia/Kolkata")!)
                Button("Request visit") { send("visit", ["c":row.text("id"),"action":"request","at_time":istInput(visitDate)]) }
            }
            NavigationLink("Report or block") { SafetyForm(target: row.text("other_id")) }
            if !issue.isEmpty { Text(issue).foregroundStyle(.red) }
        }
        .navigationTitle(row.text("display_name"))
        .task {
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(12))
            }
        }
        .refreshable { await load() }
    }
    private func load() async {
        do {
            let data = try await api.view("thread", id:row.text("id"))
            member = data.text("member")
            messages = data.rows()
        } catch { issue = error.localizedDescription; messages = [] }
    }
    private func send(_ operation: String, _ values: [String:String]) {
        Task {
            do {
                let result = try await api.mutate(operation, values)
                if operation == "message" { draft = "" }
                issue = result.text("success")
                await load()
            } catch { issue = error.localizedDescription }
        }
    }
}

func istInput(_ date: Date) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "Asia/Kolkata")
    f.dateFormat = "yyyy-MM-dd'T'HH:mm"
    return f.string(from: date)
}

struct VisitRow: View {
    @EnvironmentObject private var api: NativeAPI
    let row: Fields
    let onChange: () async -> Void
    @State private var notice = ""
    @State private var location = ""
    @State private var starts = Date().addingTimeInterval(86_400)
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(row.text("status").replacingOccurrences(of: "_", with: " ").capitalized).font(.headline)
            Text(row.text("starts_at"))
            if !row.text("location").isEmpty { Text(row.text("location")) }
            if ["requested","rescheduled","confirmed"].contains(row.text("status")) {
                DisclosureGroup("Manage visit") {
                    ForEach(row["actions"] as? [String] ?? [], id: \.self) { action in
                        Button(action.replacingOccurrences(of: "_", with: " ").capitalized) { update(action) }
                    }
                    DatePicker("New time (IST)",selection:$starts).environment(\.timeZone, TimeZone(identifier:"Asia/Kolkata")!)
                    Button("Reschedule") { update("reschedule") }
                    if row.text("status") == "confirmed" {
                        TextField("Private meeting location", text: $location)
                        Button("Share location") { change("location", ["location":location]) }
                        Button("Revoke location") { change("location", [:]) }
                    }
                }
            }
            if !notice.isEmpty { Text(notice).font(.footnote) }
        }
    }
    private func update(_ action: String) {
        var fields = ["action":action]
        if action == "reschedule" { fields["at_time"] = istInput(starts) }
        change("visit", fields)
    }
    private func change(_ operation: String, _ fields: [String:String]) {
        Task {
            do {
                _ = try await api.mutate(operation,fields.merging(["c":row.text("conversation_id"),"v":row.text("id")]) { first,_ in first })
                await onChange()
            } catch { notice = error.localizedDescription }
        }
    }
}

struct SafetyForm: View {
    @EnvironmentObject private var api: NativeAPI
    let target: String
    var listing: String? = nil
    var message: String? = nil
    @State private var category = "scam"
    @State private var details = ""
    @State private var block = false
    @State private var notice = ""
    var body: some View {
        Form {
            Picker("Reason", selection:$category) {
                ForEach(["scam","harassment","underage","stale","privacy","other"], id:\.self) { Text($0.capitalized) }
            }
            TextField("What happened?", text:$details,axis:.vertical)
            Toggle("Also block the account",isOn:$block)
            Button("Send report") {
                var fields = ["category":category,"details":details]
                if let listing { fields["listing"] = listing }
                else if let message { fields["message"] = message }
                else { fields["subject"] = target }
                if block { fields["also_block"] = "on" }
                change("report",fields)
            }.disabled(details.count < 5)
            Button("Block account",role:.destructive) { change("block",["target":target,"confirm":"on"]) }
            if !notice.isEmpty { Text(notice) }
        }.navigationTitle("Safety")
    }
    private func change(_ op: String, _ fields: [String:String]) {
        Task {
            do { notice = try await api.mutate(op,fields).text("success") }
            catch { notice = error.localizedDescription }
        }
    }
}
