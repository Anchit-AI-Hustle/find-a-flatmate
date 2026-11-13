import PhotosUI
import SwiftUI

struct Account: View {
    @EnvironmentObject private var api: NativeAPI
    @State private var home: Fields = [:]
    @State private var notice = ""
    var body: some View {
        List {
            if home.isEmpty && notice.isEmpty { ProgressView() }
            if let profile = home["profile"] as? Fields {
                Text(profile.text("display_name")).font(.headline)
                Text("Profile status: " + profile.text("status")).foregroundStyle(.secondary)
            }
            if !home.isEmpty {
                NavigationLink("Profile and lifestyle") { ProfileEditor(home: home) }
                NavigationLink("Saved items") { Feed(title: "Saved", mode: "saved") }
                NavigationLink("Connections") { Feed(title: "Connections", mode: "connections") }
                NavigationLink("My room listings") { Feed(title: "My listings", mode: "listings") }
                NavigationLink("Privacy and support") { PrivacyEditor(home: home) }
                NavigationLink("Practice matching") { Feed(title: "Practice matching", mode: "samples") }
            }
            Button("Sign out", role: .destructive) {
                Task {
                    do { try await api.signOut() }
                    catch { notice = error.localizedDescription }
                }
            }
            if !notice.isEmpty { Text(notice).foregroundStyle(.red) }
        }.navigationTitle("Account").task { await load() }.refreshable { await load() }
    }
    private func load() async {
        do { home = try await api.view("home") }
        catch { notice = error.localizedDescription }
    }
}

struct ProfileEditor: View {
    @EnvironmentObject private var api: NativeAPI
    let home: Fields
    @State private var values: [String:String] = [:]
    @State private var adult = false
    @State private var terms = false
    @State private var visible = true
    @State private var notice = ""
    private var profile: Fields { home["profile"] as? Fields ?? [:] }
    private var choices: [String:[String]] { home["dimensions"] as? [String:[String]] ?? [:] }
    private var cities: [String:Fields] { home["cities"] as? [String:Fields] ?? [:] }
    private var areas: [String:String] { cities[values["city"] ?? "gurugram"]?["areas"] as? [String:String] ?? [:] }
    var body: some View {
        Form {
            Section("Basics") {
                TextField("Display name",text:binding("name"))
                Picker("Intent",selection:binding("intent")) {
                    ForEach((home["intents"] as? [String:String] ?? [:]).sorted(by: {$0.key < $1.key}), id:\.key) { key,label in Text(label).tag(key) }
                }
                Picker("City",selection:binding("city")) {
                    ForEach(cities.keys.sorted(),id:\.self) { city in Text(cities[city]?.text("name") ?? city).tag(city) }
                }
                Picker("Preferred locality",selection:binding("areas")) {
                    Text("Choose a locality").tag("")
                    ForEach(areas.keys.sorted(),id:\.self) { a in Text(areas[a] ?? a).tag(a) }
                }.onChange(of: values["city"]) { _,_ in if areas[values["areas"] ?? ""] == nil { values["areas"] = "" } }
                TextField("Minimum budget (₹)",text:binding("min")).keyboardType(.decimalPad)
                TextField("Maximum budget (₹)",text:binding("max")).keyboardType(.decimalPad)
                TextField("Earliest move-in (YYYY-MM-DD)",text:binding("from")).keyboardType(.numbersAndPunctuation)
                TextField("Latest move-in (YYYY-MM-DD)",text:binding("until")).keyboardType(.numbersAndPunctuation)
                TextField("Planned stay in months",text:binding("months")).keyboardType(.numberPad)
                Toggle("I am 18 or older",isOn:$adult)
                Toggle("I accept the terms and privacy notice",isOn:$terms)
                Link("Terms", destination: URL(string:"/terms",relativeTo:serviceOrigin)!.absoluteURL)
                Link("Privacy notice", destination: URL(string:"/privacy",relativeTo:serviceOrigin)!.absoluteURL)
            }
            Section("Optional lifestyle answers") {
                ForEach(choices.keys.sorted(),id:\.self) { key in
                    DisclosureGroup((home["titles"] as? [String:String])?[key] ?? key.capitalized) {
                        Picker("My habit",selection:binding(key+"_habit")) { Text("Skip").tag(""); ForEach(choices[key] ?? [],id:\.self) { Text($0).tag($0) } }
                        Picker("What I prefer",selection:binding(key+"_want")) { Text("Skip").tag(""); ForEach(choices[key] ?? [],id:\.self) { Text($0).tag($0) } }
                        Picker("Importance",selection:binding(key+"_strength")) {
                            Text("Preference").tag("preference")
                            Text("Dealbreaker").tag("dealbreaker")
                            Text("Flexible").tag("flexible")
                        }
                    }
                }
            }
            if profile.isEmpty || profile.text("status") == "draft" {
                Toggle("Show my profile in discovery",isOn:$visible)
            }
            Button("Save profile") { submit() }.disabled(!adult || !terms)
            if !notice.isEmpty { Text(notice) }
        }.navigationTitle("Profile and lifestyle").onAppear { prefill() }
    }
    private func binding(_ key: String) -> Binding<String> {
        Binding(get: { values[key] ?? (key.hasSuffix("_strength") ? "preference" : "") }, set: { values[key] = $0 })
    }
    private func prefill() {
        guard values.isEmpty else { return }
        let base = istInput(Date()).prefix(10)
        values = ["name":profile.text("display_name"),"city":profile.text("city_id").isEmpty ? "gurugram" : profile.text("city_id"),
                  "areas":(profile["localities"] as? [String])?.first ?? "", "intent":profile.text("intent").isEmpty ? "looking_for_room":profile.text("intent"),
                  "min":"\(profile.integer("budget_min") / 100)","max":profile.isEmpty ? "": "\(profile.integer("budget_max") / 100)",
                  "from":profile.text("move_from").isEmpty ? String(base):profile.text("move_from"),"until":profile.text("move_until"),
                  "months":profile.isEmpty ? "6":"\(profile.integer("stay_months"))"]
        adult = !profile.isEmpty; terms = !profile.isEmpty
        for (key, answer) in (home["answers"] as? [String:Fields] ?? [:]) {
            values[key+"_habit"] = answer.text("habit")
            values[key+"_want"] = answer.text("want")
            values[key+"_strength"] = answer.text("strength")
        }
    }
    private func submit() {
        Task {
            do {
                var basics = values
                basics["adult"] = "on"; basics["terms"] = "on"
                _ = try await api.mutate("basics", basics)
                _ = try await api.mutate("lifestyle", values)
                if profile.isEmpty || profile.text("status") == "draft" {
                    var settings = ["status":"active"]
                    if visible { settings["discoverable"] = "on" }
                    _ = try await api.mutate("privacy", settings)
                }
                notice = "Profile saved."
            } catch { notice = error.localizedDescription }
        }
    }
}

struct ListingEditor: View {
    @EnvironmentObject private var api: NativeAPI
    let row: Fields
    @State private var values: [String:String] = [:]
    @State private var photo: PhotosPickerItem?
    @State private var permission = false
    @State private var attested = false
    @State private var notice = ""
    @State private var currentId = ""
    @State private var status = "draft"
    @State private var catalog: Fields = [:]
    @State private var chosenAmenities: Set<String> = []
    let names = ["title":"Room title","description":"Description","rooms":"Bedrooms","bathrooms":"Bathrooms",
                 "occupants":"Current occupants","capacity":"Total occupancy","transport":"Nearby transport",
                 "restrictions":"Other restrictions","rent":"Base rent (₹)","maintenance":"Maintenance (₹)",
                 "utilities":"Utilities estimate (₹)","recurring":"Other monthly charges (₹)","deposit":"Refundable deposit (₹)",
                 "brokerage":"Brokerage (₹)","fees":"Move-in fees (₹)","available_from":"Available from (YYYY-MM-DD)",
                 "available_until":"Latest move-in (YYYY-MM-DD)","min_months":"Minimum stay (months)"]
    let fields = ["title","description","rooms","bathrooms","occupants","capacity","transport","restrictions","rent","maintenance",
                  "utilities","recurring","deposit","brokerage","fees","available_from","available_until","min_months"]
    private var cities: [String:Fields] { catalog["cities"] as? [String:Fields] ?? [:] }
    private var areas: [String:String] { cities[values["city_id"] ?? "gurugram"]?["areas"] as? [String:String] ?? [:] }
    var body: some View {
        Form {
            Section("Room details") {
                if !currentId.isEmpty { Text("Status: " + status.replacingOccurrences(of:"_",with:" ")) }
                Picker("City", selection: binding("city_id")) {
                    ForEach(cities.keys.sorted(),id:\.self) { c in Text(cities[c]?.text("name") ?? c).tag(c) }
                }
                Picker("Locality", selection: binding("locality_id")) {
                    Text("Choose a locality").tag("")
                    ForEach(areas.keys.sorted(),id:\.self) { a in Text(areas[a] ?? a).tag(a) }
                }
                picker("Room type","room_type",["private_room","shared_room","entire_flat","other"])
                picker("Building","building",["Society apartment","Independent floor","Standalone building","Other"])
                picker("Furnishing","furnishing",["Furnished","Semi-furnished","Unfurnished"])
                picker("Bathroom","bath_sharing",["Shared","Private"])
                picker("Posting as","poster_type",["Occupant","Owner"])
                ForEach(fields,id:\.self) { key in TextField(names[key] ?? key,text:binding(key),axis:key == "description" ? .vertical : .horizontal) }
                ForEach(catalog["amenities"] as? [String] ?? [],id:\.self) { a in
                    Toggle(a,isOn:Binding(get:{ chosenAmenities.contains(a) },set:{ enabled in
                        if enabled { chosenAmenities.insert(a) } else { chosenAmenities.remove(a) }
                    }))
                }
                Toggle("I have permission to rent or sublet",isOn:$attested)
                Button("Save draft") { save() }.disabled(!attested || ["filled","removed"].contains(status))
            }
            if !currentId.isEmpty {
                Section("Photo and availability") {
                    ForEach(row.rows("listing_images"),id:\.description) { image in
                        RoomPhoto(id:image.text("id"))
                        Button("Remove photo",role:.destructive) { act("removePhoto",["id":image.text("id")]) }
                    }
                    PhotosPicker(selection:$photo,matching:.images) { Text("Select a room photo") }
                    Toggle("I have permission to share this photo",isOn:$permission)
                    Button("Upload photo") { upload() }.disabled(photo == nil || !permission || status != "draft")
                    if status == "draft" { Button("Submit for review") { transition("submit","pending_review") } }
                    if status == "active" { Button("Pause") { transition("pause","paused") } }
                    if ["active","paused","expired"].contains(status) { Button("Confirm still available") { transition("renew","active") } }
                    if !["filled","removed"].contains(status) { Button("Mark as filled",role:.destructive) { transition("fill","filled") } }
                }
            }
            if !notice.isEmpty { Text(notice) }
        }.navigationTitle(row.isEmpty ? "List a room" : "Manage listing").task {
            if values.isEmpty { prefill() }
            catalog = (try? await api.view("home")) ?? [:]
        }
    }
    private func binding(_ key: String) -> Binding<String> { Binding(get:{values[key] ?? ""},set:{values[key] = $0}) }
    private func picker(_ label:String,_ key:String,_ options:[String]) -> some View {
        Picker(label,selection:binding(key)) { ForEach(options,id:\.self) { Text($0.replacingOccurrences(of:"_",with:" ").capitalized).tag($0) } }
    }
    private func prefill() {
        currentId = row.text("id")
        if !row.isEmpty { status = row.text("status") }
        values = ["city_id":"gurugram","locality_id":"","room_type":"private_room","building":"Society apartment","furnishing":"Furnished",
                  "bath_sharing":"Shared","poster_type":"Occupant","rooms":"2","bathrooms":"1","occupants":"1","capacity":"2",
                  "transport":"","restrictions":"","utilities":"","maintenance":"0","recurring":"0","deposit":"0",
                  "brokerage":"0","fees":"0","min_months":"3","available_from":String(istInput(Date()).prefix(10))]
        for key in fields + ["city_id","locality_id","room_type","building","furnishing","bath_sharing","poster_type"] {
            if let value = row[key] as? String { values[key] = value }
            if let value = row[key] as? NSNumber {
                if ["rent","maintenance","utilities","recurring","deposit","brokerage","fees"].contains(key) { values[key] = String(format:"%.2f",value.doubleValue/100) }
                else { values[key] = value.stringValue }
            }
        }
        chosenAmenities = Set(row.rows("listing_amenities").map { $0.text("amenity") })
        for answer in row.rows("household_preferences") {
            let k = answer.text("dimension")
            values[k+"_habit"] = answer.text("habit"); values[k+"_want"] = answer.text("expectation"); values[k+"_strength"] = answer.text("strength")
        }
        attested = !row.isEmpty
    }
    private func save() {
        Task {
            do {
                var fields = values
                fields["id"] = currentId
                fields["attested"] = "on"
                let reply = try await api.mutate("listing",fields, repeats:["amenities":Array(chosenAmenities)])
                if !reply.text("listing").isEmpty { currentId = reply.text("listing") }
                notice = reply.text("success")
                status = "draft"
            } catch { notice = error.localizedDescription }
        }
    }
    private func upload() {
        Task {
            do {
                guard let data = try await photo?.loadTransferable(type:Data.self),
                      let image = UIImage(data:data), let jpeg = image.jpegData(compressionQuality:0.65), jpeg.count <= 2_500_000 else {
                    notice = "Choose a smaller JPEG, PNG or WebP photo."; return
                }
                notice = try await api.mutate("upload",["id":currentId,"permission":"on"],photo:jpeg).text("success")
                photo = nil
            } catch { notice = error.localizedDescription }
        }
    }
    private func transition(_ value:String,_ next:String) { act("listingState",["id":currentId,"action":value],next:next) }
    private func act(_ op:String,_ fields:[String:String],next:String?=nil) {
        Task {
            do {
                notice = try await api.mutate(op,fields).text("success")
                if let next { status = next }
            } catch { notice = error.localizedDescription }
        }
    }
}

struct PrivacyEditor: View {
    @EnvironmentObject private var api: NativeAPI
    let home: Fields
    @State private var discoverable = true
    @State private var analytics = false
    @State private var reminders = false
    @State private var paused = false
    @State private var support = ""
    @State private var notice = ""
    @State private var confirm = false
    var body: some View {
        Form {
            Section("Privacy") {
                Toggle("Show my profile in discovery",isOn:$discoverable)
                Toggle("Allow optional usage measurement",isOn:$analytics)
                Toggle("Allow future reminders",isOn:$reminders)
                Toggle("Pause my profile",isOn:$paused)
                Button("Save privacy choices") {
                    var fields = ["status":paused ? "paused":"active"]
                    if discoverable { fields["discoverable"] = "on" }
                    if analytics { fields["analytics"] = "on" }
                    if reminders { fields["reminders"] = "on" }
                    submit("privacy",fields)
                }
            }
            Section("Your data and support") {
                Button("Request data export") { submit("request",["kind":"export"]) }
                TextField("What do you need help with?",text:$support,axis:.vertical)
                Button("Send to support") { submit("request",["kind":"support","details":support]) }.disabled(support.isEmpty)
                Toggle("Confirm account closure",isOn:$confirm)
                Button("Close and request deletion",role:.destructive) { submit("request",["kind":"delete","confirm":"on"]) }.disabled(!confirm)
            }
            if !notice.isEmpty { Text(notice) }
        }.navigationTitle("Privacy and support").onAppear {
            discoverable = (home["profile"] as? Fields)?["discoverable"] as? Bool ?? true
            paused = (home["profile"] as? Fields)?.text("status") == "paused"
            analytics = home["analytics"] as? Bool ?? false
            reminders = home["reminders"] as? Bool ?? false
        }
    }
    private func submit(_ operation:String,_ fields:[String:String]) {
        Task {
            do { notice = try await api.mutate(operation,fields).text("success") }
            catch { notice = error.localizedDescription }
        }
    }
}
