package com.findaflatmate.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.app.TimePickerDialog;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int INK = Color.rgb(22,35,35), FOREST = Color.rgb(7,91,74), IVORY = Color.rgb(251,249,245);
    private final ExecutorService requests = Executors.newFixedThreadPool(3);
    private LinearLayout page;
    private NativeApi api;
    private int renderVersion;
    private Runnable back;
    private java.util.function.Consumer<byte[]> photoHandler;
    private String visitTime;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        api = new NativeApi(this);
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, () -> {
            if (back != null) back.run(); else finish();
        });
        if (!handle(getIntent())) start();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handle(intent);
    }

    private boolean handle(Intent intent) {
        Uri uri = intent.getData();
        if (uri == null || !"findaflatmate".equals(uri.getScheme()) || !"auth".equals(uri.getHost())) return false;
        screen("Finishing sign-in", false);
        add(page, "Connecting to Find a Flatmate…",16,false);
        run(() -> { api.finish(uri.getQueryParameter("code")); return true; }, ignored -> start(), this::welcome);
        return true;
    }

    private void start() { if (api.signedIn()) feed("people"); else welcome(); }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private LinearLayout column() {
        LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); return l;
    }
    private LinearLayout row() {
        LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.HORIZONTAL); l.setGravity(Gravity.CENTER_VERTICAL); return l;
    }
    private void screen(String title, boolean signed) {
        renderVersion++;
        LinearLayout root = column();
        root.setBackgroundColor(IVORY);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(0,insets.getSystemWindowInsetTop(),0,insets.getSystemWindowInsetBottom()); return insets;
        });
        ScrollView scroller = new ScrollView(this);
        scroller.setFillViewport(true);
        page = column(); page.setPadding(dp(20),dp(15),dp(20),dp(24));
        scroller.addView(page);
        root.addView(scroller,new LinearLayout.LayoutParams(-1,0,1));
        add(page,title,30,true).setAccessibilityHeading(true);
        if (signed) {
            LinearLayout bar = row(); bar.setPadding(dp(8),dp(4),dp(8),dp(4));
            nav(bar,"Discover",() -> feed("people"));
            nav(bar,"Messages",() -> feed("messages"));
            nav(bar,"Visits",() -> feed("visits"));
            nav(bar,"Account",this::account);
            root.addView(bar);
        }
        setContentView(root);
    }
    private TextView add(LinearLayout parent, String value, int size, boolean strong) {
        TextView view = new TextView(this);
        view.setText(value); view.setTextColor(INK); view.setTextSize(size);
        if (strong) view.setTypeface(size >= 25 ? Typeface.SERIF : Typeface.DEFAULT,Typeface.BOLD);
        view.setPadding(0,dp(6),0,dp(6)); parent.addView(view);
        return view;
    }
    private Button button(LinearLayout parent, String value, Runnable onTap) {
        Button button = new Button(this);
        button.setText(value); button.setAllCaps(false); button.setMinHeight(dp(48));
        button.setTextColor(FOREST); button.setOnClickListener(v -> onTap.run());
        parent.addView(button); return button;
    }
    private void nav(LinearLayout parent,String value,Runnable onTap) {
        Button b = button(parent,value,onTap); b.setPadding(0,0,0,0); b.setTextSize(12);
        b.setLayoutParams(new LinearLayout.LayoutParams(0,dp(52),1));
    }
    private LinearLayout card() {
        LinearLayout c = column(); c.setPadding(dp(14),dp(12),dp(14),dp(12));
        GradientDrawable bg = new GradientDrawable(); bg.setColor(Color.WHITE); bg.setCornerRadius(dp(18)); bg.setStroke(dp(1),0xffd4ded6);
        c.setBackground(bg);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1,-2);
        params.setMargins(0,dp(10),0,dp(4)); page.addView(c,params); return c;
    }
    private void welcome() {
        back = null;
        screen("Find someone you can actually live with.",false);
        add(page,"Compare everyday habits and real housing costs in Gurugram and Noida.",17,false);
        ImageView art = new ImageView(this); art.setImageResource(com.findaflatmate.app.R.drawable.flatmate_hero); art.setAdjustViewBounds(true);
        art.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        page.addView(art,new LinearLayout.LayoutParams(-1,-2));
        button(page,"Sign in or create an account",() -> run(api::begin,uri -> startActivity(new Intent(Intent.ACTION_VIEW,uri)),null));
        add(page,"Continue with Google or an email link. For adults 18 and over.",14,false);
        button(page,"Try matching with examples",() -> feed("samples"));
    }
    private void feed(String kind) {
        boolean signed = api.signedIn();
        back = kind.equals("people") ? null : signed ? () -> feed("people") : this::welcome;
        screen(title(kind),signed);
        if (kind.equals("people") || kind.equals("rooms")) {
            LinearLayout bar = row(); page.addView(bar); nav(bar,"People",() -> feed("people")); nav(bar,"Rooms",() -> feed("rooms")); nav(bar,"Examples",() -> feed("samples"));
        }
        if (kind.equals("listings")) button(page,"List a room",() -> openListing(new JSONObject()));
        button(page,"Refresh",() -> feed(kind));
        if (kind.equals("samples")) add(page,"Fictional people and rooms for practising with the real matching rules.",15,false);
        TextView loading = add(page,"Loading…",15,false);
        int version = renderVersion;
        run(() -> api.get(kind,null), data -> {
            if (version != renderVersion) return;
            loading.setVisibility(View.GONE);
            List<JSONObject> items = items(data,kind.equals("samples") ? "people":"items");
            if (kind.equals("samples")) items.addAll(items(data,"rooms"));
            if (items.isEmpty()) add(page,"Nothing here yet.",16,false);
            for (JSONObject item : items) renderItem(kind,item);
        }, () -> { if (version == renderVersion) loading.setVisibility(View.GONE); });
    }

    private void renderItem(String kind, JSONObject item) {
        LinearLayout c = card();
        String id = item.optString("id");
        if (kind.equals("messages")) {
            add(c,item.optString("display_name"),19,true);
            if (item.optInt("unread") > 0) add(c,item.optInt("unread") + " unread",14,false);
            button(c,"Open conversation",() -> thread(item)); return;
        }
        if (kind.equals("visits")) { visit(c,item); return; }
        add(c,item.optString("title"),19,true);
        if (kind.equals("samples")) add(c,item.optString("blurb"),15,false);
        if (kind.equals("rooms")) {
            add(c, "₹" + item.optInt("monthly") / 100 + " monthly · ₹" + item.optInt("deposit") / 100 + " refundable deposit",15,false);
            if (item.isNull("utilities")) add(c,"Utilities are unknown.",14,false);
            add(c,item.optString("description"),15,false);
            List<JSONObject> images = items(item,"listing_images");
            if (!images.isEmpty()) showPhoto(c,images.get(0).optString("id"));
        }
        JSONObject fit = item.optJSONObject("fit");
        if (fit != null) {
            add(c,fit.isNull("score") ? "More information needed" : fit.optInt("score") + "/100 fit",15,true);
            for (String reason : strings(fit,"top_reasons")) add(c,reason,14,false);
            for (String reason : strings(fit,"potential_friction")) add(c,reason,14,false);
        }
        if (kind.equals("rooms") || kind.equals("people")) {
            boolean room = kind.equals("rooms");
            String target = room ? item.optString("owner_id") : id;
            LinearLayout choices = row(); c.addView(choices);
            nav(choices,"Like",() -> change("interest",room ? Map.of("target",target,"action","like","listing",id) : Map.of("target",target,"action","like"),() -> feed(kind)));
            nav(choices,"Save",() -> change("save",Map.of("kind",room ? "listing":"profile","target",id,"enabled","yes"),null));
            nav(choices,"Pass",() -> change("interest",Map.of("target",target,"action","pass"),() -> feed(kind)));
            button(c,"Report or block",() -> safety(target,room ? id:null,null));
        } else if (kind.equals("connections")) {
            button(c,"Accept interest",() -> change("interest",Map.of("target",id,"action","like"),() -> feed(kind)));
        } else if (kind.equals("saved")) {
            button(c,"Remove saved item",() -> change("save",Map.of("kind",item.optString("kind"),"target",id,"enabled","no"),() -> feed(kind)));
        } else if (kind.equals("listings")) {
            add(c,item.optString("status").replace('_',' '),14,false);
            button(c,"Manage room",() -> openListing(item));
        }
    }

    private void showPhoto(LinearLayout parent,String id) {
        ImageView image = new ImageView(this); image.setAdjustViewBounds(true); image.setContentDescription("Room photo");
        parent.addView(image,new LinearLayout.LayoutParams(-1,-2));
        run(() -> api.photo(id),bytes -> image.setImageBitmap(BitmapFactory.decodeByteArray(bytes,0,bytes.length)),null);
    }

    private void thread(JSONObject conversation) {
        back = () -> feed("messages");
        String id = conversation.optString("id"), other = conversation.optString("other_id");
        screen(conversation.optString("display_name"),true);
        button(page,"Refresh conversation",() -> thread(conversation));
        TextView loading = add(page,"Loading messages…",15,false);
        LinearLayout messages = column(); page.addView(messages);
        int version = renderVersion;
        run(() -> api.get("thread",id),data -> {
            if (renderVersion != version) return;
            loading.setVisibility(View.GONE);
            for (JSONObject msg : items(data,"items")) {
                boolean mine = msg.optString("sender_id").equals(data.optString("member"));
                add(messages,(mine ? "You: " : conversation.optString("display_name") + ": ") + msg.optString("body"),16,false);
                if (msg.optBoolean("suspicious")) add(messages,"Check requests for payments or personal details.",14,true);
                if (!mine) button(messages,"Report message",() -> safety(other,null,msg.optString("id")));
            }
        },() -> loading.setVisibility(View.GONE));
        EditText input = field(page,"Write a message","");
        button(page,"Send",() -> change("message",Map.of("c",id,"body",input.getText().toString(),"request_key",UUID.randomUUID().toString()),() -> thread(conversation)));
        button(page,"Request a visit",() -> pickDate(value -> change("visit",Map.of("c",id,"action","request","at_time",value),() -> feed("visits"))));
        button(page,"Report or block",() -> safety(other,null,null));
    }

    private void visit(LinearLayout c, JSONObject item) {
        String status = item.optString("status"), id = item.optString("id"), conversation = item.optString("conversation_id");
        add(c,status.replace('_',' '),19,true);
        add(c,item.optString("starts_at"),15,false);
        if (!item.isNull("location")) add(c,item.optString("location"),15,false);
        for (String action : strings(item,"actions")) button(c,title(action),() -> change("visit",Map.of("c",conversation,"v",id,"action",action),() -> feed("visits")));
        if (List.of("confirmed","requested","rescheduled").contains(status)) {
            button(c,"Suggest another time",() -> pickDate(value -> change("visit",Map.of("c",conversation,"v",id,"action","reschedule","at_time",value),() -> feed("visits"))));
            if (status.equals("confirmed")) {
                EditText address = field(c,"Private meeting location","");
                button(c,"Share location",() -> change("location",Map.of("c",conversation,"v",id,"location",address.getText().toString()),() -> feed("visits")));
                button(c,"Revoke my location",() -> change("location",Map.of("c",conversation,"v",id),() -> feed("visits")));
            }
        }
    }

    private void pickDate(java.util.function.Consumer<String> done) {
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Kolkata")).plusDays(1);
        new DatePickerDialog(this,(ignored,y,m,d) -> {
            visitTime = String.format(java.util.Locale.ROOT,"%04d-%02d-%02d",y,m+1,d);
            new TimePickerDialog(this,(p,h,min) -> done.accept(visitTime + String.format(java.util.Locale.ROOT,"T%02d:%02d",h,min)),18,0,true).show();
        },date.getYear(),date.getMonthValue()-1,date.getDayOfMonth()).show();
    }

    private void safety(String target,String listing,String message) {
        back = () -> feed("people"); screen("Report or block",true);
        Spinner category = picker(page,"Reason",List.of("scam","harassment","underage","stale","privacy","other"),"scam");
        EditText detail = field(page,"What happened?","");
        CheckBox also = check(page,"Also block the account",false);
        button(page,"Send report",() -> {
            Map<String,String> values = new LinkedHashMap<>(Map.of("category",chosen(category),"details",detail.getText().toString()));
            values.put(listing != null ? "listing" : message != null ? "message":"subject",listing != null ? listing : message != null ? message:target);
            if (also.isChecked()) values.put("also_block","on");
            change("report",values,() -> feed("people"));
        });
        button(page,"Block account",() -> new AlertDialog.Builder(this).setMessage("End contact with this account?")
            .setNegativeButton("Cancel",null).setPositiveButton("Block",(d,w) -> change("block",Map.of("target",target,"confirm","on"),() -> feed("people"))).show());
    }

    private void account() {
        back = () -> feed("people"); screen("Account",true);
        int version = renderVersion;
        run(() -> api.get("home",null),data -> {
            if (version != renderVersion) return;
            JSONObject p = data.optJSONObject("profile");
            if (p != null) add(page,p.optString("display_name"),20,true);
            button(page,"Profile and lifestyle",() -> editProfile(data));
            button(page,"Saved items",() -> feed("saved"));
            button(page,"Connections",() -> feed("connections"));
            button(page,"My listings",() -> feed("listings"));
            button(page,"Privacy and support",() -> privacy(data));
        },null);
        button(page,"Sign out",() -> run(() -> { api.signOut(); return true; },ignored -> welcome(),null));
    }

    private void editProfile(JSONObject home) {
        back = this::account; screen("Profile and lifestyle",true);
        JSONObject p = home.optJSONObject("profile");
        if (p == null) p = new JSONObject();
        boolean onboarding = p.optString("status","draft").equals("draft");
        Map<String,EditText> inputs = new LinkedHashMap<>();
        inputs.put("name",field(page,"Display name",p.optString("display_name")));
        Spinner intent = picker(page,"Intent",List.of("looking_for_room","have_room","find_together"),p.optString("intent","looking_for_room"));
        JSONObject catalog = home.optJSONObject("cities");
        Spinner city = picker(page,"City",List.of("gurugram","noida"),p.optString("city_id","gurugram"));
        Spinner area = picker(page,"Preferred locality",List.of("sector-56","dlf-phase-3","sector-62","sector-137"),first(p,"localities"));
        inputs.put("min",field(page,"Minimum monthly budget (₹)",String.valueOf(p.optInt("budget_min") / 100)));
        inputs.put("max",field(page,"Maximum monthly budget (₹)",p.has("budget_max") ? String.valueOf(p.optInt("budget_max") / 100):""));
        inputs.put("from",field(page,"Earliest move-in (YYYY-MM-DD)",p.optString("move_from",LocalDate.now(ZoneId.of("Asia/Kolkata")).toString())));
        inputs.put("until",field(page,"Latest move-in (YYYY-MM-DD)",p.optString("move_until")));
        inputs.put("months",field(page,"Planned stay in months",String.valueOf(p.optInt("stay_months",6))));
        CheckBox adult = check(page,"I am 18 or older",p.length() > 0), terms = check(page,"I accept the terms and privacy notice",p.length() > 0);
        button(page,"Read terms",() -> link("/terms")); button(page,"Read privacy notice",() -> link("/privacy"));
        Map<String,Spinner> lifestyle = new LinkedHashMap<>();
        habits(home,home.optJSONObject("answers"),lifestyle);
        CheckBox visible = onboarding ? check(page,"Show my profile in discovery",true) : null;
        button(page,"Save profile",() -> {
            if (!adult.isChecked() || !terms.isChecked()) { toast("Confirm your age and accept the terms."); return; }
            JSONObject cityData = catalog == null ? null : catalog.optJSONObject(chosen(city));
            if (cityData != null && !cityData.optJSONObject("areas").has(chosen(area))) { toast("Choose a locality in your selected city."); return; }
            Map<String,String> values = gather(inputs);
            values.putAll(Map.of("intent",chosen(intent),"city",chosen(city),"areas",chosen(area),"adult","on","terms","on"));
            Map<String,String> answers = selections(lifestyle);
            boolean discoverable = visible != null && visible.isChecked();
            run(() -> {
                api.mutate("basics",values);
                api.mutate("lifestyle",answers);
                if (onboarding) api.mutate("privacy",discoverable ? Map.of("status","active","discoverable","on"):Map.of("status","active"));
                return true;
            },ignored -> { toast("Profile saved."); account(); },null);
        });
    }

    private void habits(JSONObject home,JSONObject answers,Map<String,Spinner> controls) {
        JSONObject dims = home.optJSONObject("dimensions");
        if (dims == null) return;
        add(page,"Optional lifestyle and house rules",20,true);
        for (var keys = dims.keys(); keys.hasNext();) {
            String dim = keys.next();
            List<String> values = new ArrayList<>(List.of("Skip"));
            values.addAll(strings(dims,dim));
            JSONObject prior = answers == null ? null : answers.optJSONObject(dim);
            controls.put(dim+"_habit",picker(page,title(dim) + " habit",values,prior == null ? "Skip":prior.optString("habit","Skip")));
            controls.put(dim+"_want",picker(page,title(dim) + " preference",values,prior == null ? "Skip":prior.optString("want","Skip")));
            controls.put(dim+"_strength",picker(page,title(dim) + " importance",List.of("preference","flexible","dealbreaker"),prior == null ? "preference":prior.optString("strength","preference")));
        }
    }

    private void openListing(JSONObject listing) {
        run(() -> api.get("home",null),home -> editListing(listing,home),null);
    }

    private void editListing(JSONObject listing,JSONObject home) {
        back = () -> feed("listings"); screen("Room listing",true);
        String id = listing.optString("id"), status = listing.optString("status","draft");
        Map<String,EditText> inputs = new LinkedHashMap<>();
        String[][] specs = {{"title","Title",""},{"description","Description",""},{"rooms","Bedrooms","2"},{"bathrooms","Bathrooms","1"},{"occupants","Current occupants","1"},{"capacity","Total occupants","2"},
            {"transport","Nearby transport",""},{"restrictions","Other restrictions",""},{"rent","Base rent (₹)",""},{"maintenance","Maintenance (₹)","0"},{"utilities","Utilities estimate (₹)",""},
            {"recurring","Other monthly charges (₹)","0"},{"deposit","Refundable deposit (₹)","0"},{"brokerage","Brokerage (₹)","0"},{"fees","Move-in fees (₹)","0"},
            {"available_from","Available from (YYYY-MM-DD)",LocalDate.now(ZoneId.of("Asia/Kolkata")).toString()},{"available_until","Latest move-in (YYYY-MM-DD)",""},{"min_months","Minimum stay in months","3"}};
        List<String> money = List.of("rent","maintenance","utilities","recurring","deposit","brokerage","fees");
        for (String[] spec : specs) {
            String initial = listing.optString(spec[0],spec[2]);
            if (money.contains(spec[0]) && !listing.isNull(spec[0])) initial = String.format(java.util.Locale.ROOT,"%.2f",listing.optInt(spec[0])/100.0);
            inputs.put(spec[0],field(page,spec[1],initial));
        }
        Map<String,Spinner> fields = new LinkedHashMap<>();
        fields.put("city_id",picker(page,"City",List.of("gurugram","noida"),listing.optString("city_id","gurugram")));
        fields.put("locality_id",picker(page,"Locality",List.of("sector-56","dlf-phase-3","sector-62","sector-137"),listing.optString("locality_id")));
        fields.put("room_type",picker(page,"Room type",List.of("private_room","shared_room","entire_flat","other"),listing.optString("room_type")));
        fields.put("building",picker(page,"Building type",List.of("Society apartment","Independent floor","Standalone building","Other"),listing.optString("building")));
        fields.put("furnishing",picker(page,"Furnishing",List.of("Furnished","Semi-furnished","Unfurnished"),listing.optString("furnishing")));
        fields.put("bath_sharing",picker(page,"Bathroom",List.of("Shared","Private"),listing.optString("bath_sharing")));
        fields.put("poster_type",picker(page,"Posting as",List.of("Occupant","Owner"),listing.optString("poster_type")));
        List<String> enabled = items(listing,"listing_amenities").stream().map(x -> x.optString("amenity")).collect(java.util.stream.Collectors.toList());
        Map<String,CheckBox> selected = new LinkedHashMap<>();
        for (String option : strings(home,"amenities")) selected.put(option,check(page,option,enabled.contains(option)));
        JSONObject rules = new JSONObject();
        for (JSONObject a : items(listing,"household_preferences")) {
            try { rules.put(a.optString("dimension"),new JSONObject().put("habit",a.optString("habit","Skip")).put("want",a.optString("expectation","Skip")).put("strength",a.optString("strength"))); }
            catch (Exception ignored) { }
        }
        habits(home,rules,fields);
        CheckBox attested = check(page,"I have permission to rent or sublet",!id.isEmpty());
        button(page,"Save draft",() -> {
            if (!attested.isChecked()) { toast("Confirm permission to post."); return; }
            Map<String,String> values = gather(inputs);
            values.putAll(selections(fields)); values.put("id",id); values.put("attested","on");
            List<String> options = selected.entrySet().stream().filter(e -> e.getValue().isChecked()).map(Map.Entry::getKey).collect(java.util.stream.Collectors.toList());
            run(() -> api.mutate("listing",values,Map.of("amenities",options),null),reply -> {
                toast(reply.optString("success"));
                refreshListing(reply.optString("listing",id),home);
            },null);
        });
        if (!id.isEmpty()) {
            for (JSONObject photo : items(listing,"listing_images")) {
                showPhoto(page,photo.optString("id"));
                if (status.equals("draft")) button(page,"Remove photo",() -> change("removePhoto",Map.of("id",photo.optString("id")),() -> refreshListing(id,home)));
            }
            if (status.equals("draft")) {
                CheckBox permission = check(page,"I have permission to share this photo",false);
                button(page,"Choose and upload a photo",() -> {
                    if (!permission.isChecked()) { toast("Confirm permission first."); return; }
                    choosePhoto(bytes -> run(() -> api.mutate("upload",Map.of("id",id,"permission","on"),Map.of(),bytes),
                        result -> { toast(result.optString("success")); refreshListing(id,home); },null));
                });
                button(page,"Submit for review",() -> listingState(id,"submit",home));
            }
            if (status.equals("active")) button(page,"Pause",() -> listingState(id,"pause",home));
            if (List.of("active","paused","expired").contains(status)) button(page,"Confirm still available",() -> listingState(id,"renew",home));
            if (!List.of("filled","removed").contains(status)) button(page,"Mark as filled",() -> listingState(id,"fill",home));
        }
    }

    private void listingState(String id,String action,JSONObject home) {
        change("listingState",Map.of("id",id,"action",action),() -> refreshListing(id,home));
    }
    private void refreshListing(String id,JSONObject home) {
        run(() -> api.get("listings",id),reply -> {
            List<JSONObject> rows = items(reply,"items");
            if (rows.isEmpty()) feed("listings"); else editListing(rows.get(0),home);
        },null);
    }

    private void privacy(JSONObject home) {
        back = this::account; screen("Privacy and support",true);
        JSONObject p = home.optJSONObject("profile");
        CheckBox visibility = check(page,"Show my profile in discovery",p != null && p.optBoolean("discoverable"));
        CheckBox analytics = check(page,"Allow optional usage measurement",home.optBoolean("analytics"));
        CheckBox reminders = check(page,"Allow future reminders",home.optBoolean("reminders"));
        CheckBox paused = check(page,"Pause my profile",p != null && p.optString("status").equals("paused"));
        button(page,"Save privacy choices",() -> {
            Map<String,String> fields = new LinkedHashMap<>(Map.of("status",paused.isChecked() ? "paused":"active"));
            if (visibility.isChecked()) fields.put("discoverable","on");
            if (analytics.isChecked()) fields.put("analytics","on");
            if (reminders.isChecked()) fields.put("reminders","on");
            change("privacy",fields,null);
        });
        button(page,"Request data export",() -> change("request",Map.of("kind","export"),null));
        EditText support = field(page,"What do you need help with?","");
        button(page,"Send to support",() -> change("request",Map.of("kind","support","details",support.getText().toString()),null));
        CheckBox confirm = check(page,"Confirm account closure",false);
        button(page,"Close and request deletion",() -> {
            if (confirm.isChecked()) change("request",Map.of("kind","delete","confirm","on"),this::account);
            else toast("Confirm account closure first.");
        });
    }

    private void choosePhoto(java.util.function.Consumer<byte[]> handler) {
        photoHandler = handler;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(intent,42);
    }
    @Override protected void onActivityResult(int request,int result,Intent intent) {
        super.onActivityResult(request,result,intent);
        if (request != 42 || result != RESULT_OK || intent == null || intent.getData() == null || photoHandler == null) return;
        var handler = photoHandler; photoHandler = null;
        run(() -> {
            try (var input = getContentResolver().openInputStream(intent.getData())) {
                byte[] bytes = input == null ? null : input.readNBytes(12_000_001);
                if (bytes == null || bytes.length > 12_000_000) throw new IllegalArgumentException("Choose a smaller photo.");
                var bitmap = BitmapFactory.decodeByteArray(bytes,0,bytes.length);
                if (bitmap == null) throw new IllegalArgumentException("Choose a valid room photo.");
                ByteArrayOutputStream output = new ByteArrayOutputStream(); bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG,70,output);
                if (output.size() > 2_500_000) throw new IllegalArgumentException("Choose a smaller photo.");
                return output.toByteArray();
            }
        },handler,null);
    }

    private EditText field(LinearLayout parent,String label,String value) {
        TextView title = add(parent,label,14,true);
        EditText input = new EditText(this); input.setId(View.generateViewId()); title.setLabelFor(input.getId());
        input.setHint(label); input.setText(value); input.setTextSize(16); input.setMinHeight(dp(48)); parent.addView(input); return input;
    }
    private CheckBox check(LinearLayout parent,String label,boolean selected) {
        CheckBox box = new CheckBox(this); box.setText(label); box.setChecked(selected); box.setMinHeight(dp(48)); parent.addView(box); return box;
    }
    private Spinner picker(LinearLayout parent,String label,List<String> options,String chosen) {
        TextView title = add(parent,label,14,true);
        Spinner spinner = new Spinner(this); spinner.setId(View.generateViewId()); title.setLabelFor(spinner.getId());
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,options);
        spinner.setAdapter(adapter); spinner.setSelection(Math.max(0,options.indexOf(chosen))); spinner.setMinimumHeight(dp(48));
        parent.addView(spinner); return spinner;
    }
    private static String chosen(Spinner field) { return field.getSelectedItem().toString(); }
    private static Map<String,String> gather(Map<String,EditText> fields) {
        Map<String,String> result = new LinkedHashMap<>();
        fields.forEach((k,v) -> result.put(k,v.getText().toString())); return result;
    }
    private static Map<String,String> selections(Map<String,Spinner> fields) {
        Map<String,String> result = new LinkedHashMap<>();
        fields.forEach((k,v) -> { if (!chosen(v).equals("Skip")) result.put(k,chosen(v)); }); return result;
    }
    private static List<JSONObject> items(JSONObject obj,String key) {
        List<JSONObject> values = new ArrayList<>(); JSONArray list = obj.optJSONArray(key);
        if (list != null) for (int i=0;i<list.length();i++) if (list.optJSONObject(i) != null) values.add(list.optJSONObject(i));
        return values;
    }
    private static List<String> strings(JSONObject obj,String key) {
        List<String> values = new ArrayList<>(); JSONArray list = obj.optJSONArray(key);
        if (list != null) for (int i=0;i<list.length();i++) values.add(list.optString(i));
        return values;
    }
    private static String first(JSONObject obj,String key) { return strings(obj,key).stream().findFirst().orElse(""); }
    private static String title(String name) { return name.substring(0,1).toUpperCase(java.util.Locale.ROOT) + name.substring(1).replace('_',' '); }
    private void link(String path) { startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(NativeApi.ORIGIN + path))); }
    private void toast(String value) { if (!value.isEmpty()) Toast.makeText(this,value,Toast.LENGTH_LONG).show(); }
    private void change(String op,Map<String,String> values,Runnable after) {
        run(() -> api.mutate(op,values),reply -> { toast(reply.optString("success")); if (after != null) after.run(); },null);
    }
    private <T> void run(Callable<T> operation,java.util.function.Consumer<T> done,Runnable failed) {
        requests.execute(() -> {
            try {
                T value = operation.call(); runOnUiThread(() -> done.accept(value));
            } catch (Exception error) {
                runOnUiThread(() -> {
                    toast(error.getLocalizedMessage() == null ? "Try again shortly." : error.getLocalizedMessage());
                    if (failed != null) failed.run();
                    else if (!api.signedIn() && back != null) welcome();
                });
            }
        });
    }

    @Override protected void onDestroy() { requests.shutdownNow(); super.onDestroy(); }
}
