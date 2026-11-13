package com.findaflatmate.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class NativeApi {
    static final String ORIGIN = "https://find-a-flatmate.anchit-tandon.com";
    private static final String ALIAS = "findaflatmate-session-v1";
    private final SharedPreferences storage;
    private String token;
    private String verifier;

    NativeApi(Context context) {
        storage = context.getSharedPreferences("secure-session", Context.MODE_PRIVATE);
        token = read("token");
        verifier = read("verifier");
    }

    boolean signedIn() { return token != null; }

    Uri begin() throws Exception {
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        verifier = urlEncode(random);
        save("verifier", verifier);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8));
        return Uri.parse(ORIGIN + "/mobile/authorize?challenge=" + urlEncode(digest));
    }

    void finish(String code) throws Exception {
        if (verifier == null || code == null || !code.matches("[A-Za-z0-9_-]{43}")) throw new IOException("Start sign-in again.");
        JSONObject input = new JSONObject().put("code", code).put("verifier", verifier);
        JSONObject result = request("/api/mobile/session", "POST", "application/json", input.toString().getBytes(StandardCharsets.UTF_8));
        token = result.getString("token");
        save("token", token);
        verifier = null;
        storage.edit().remove("verifier").apply();
    }

    void signOut() throws Exception {
        request("/api/mobile/session", "DELETE", null, null);
        clear();
    }

    JSONObject get(String view, String id) throws Exception {
        return request("/api/mobile/data?view=" + view + (id == null ? "" : "&id=" + Uri.encode(id)), "GET", null, null);
    }

    byte[] photo(String id) throws Exception {
        return send("/api/media/" + Uri.encode(id), "GET", null, null);
    }

    JSONObject mutate(String action, Map<String,String> values) throws Exception {
        return mutate(action, values, Map.of(), null);
    }

    JSONObject mutate(String action, Map<String,String> values, Map<String,List<String>> repeated, byte[] photo) throws Exception {
        String boundary = UUID.randomUUID().toString();
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        for (var field : values.entrySet()) append(body,boundary,field.getKey(),field.getValue());
        for (var field : repeated.entrySet()) for (String value : field.getValue()) append(body,boundary,field.getKey(),value);
        if (photo != null) {
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"room.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            body.write(photo);
            body.write("\r\n".getBytes(StandardCharsets.UTF_8));
        }
        body.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return request("/api/mobile/data?op=" + action,"POST","multipart/form-data; boundary=" + boundary,body.toByteArray());
    }

    private void append(ByteArrayOutputStream body, String boundary, String key, String value) throws IOException {
        body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + key + "\"\r\n\r\n" + value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private JSONObject request(String path, String method, String contentType, byte[] body) throws Exception {
        byte[] bytes = send(path,method,contentType,body);
        return bytes.length == 0 ? new JSONObject() : new JSONObject(new String(bytes,StandardCharsets.UTF_8));
    }

    private byte[] send(String path, String method, String contentType, byte[] body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(ORIGIN + path).openConnection();
        try {
            connection.setConnectTimeout(12_000);
            connection.setReadTimeout(15_000);
            connection.setRequestMethod(method);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            if (token != null) connection.setRequestProperty("Authorization","Bearer " + token);
            if (body != null) {
                connection.setRequestProperty("Content-Type",contentType);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(body.length);
                try (var stream = connection.getOutputStream()) { stream.write(body); }
            }
            int status = connection.getResponseCode();
            if (status == 401 && path.startsWith("/api/mobile/data")) clear();
            if (status < 200 || status >= 300) {
                String error = status == 401 ? "Sign in to continue." : "Could not complete this request. Try again.";
                try (var stream = connection.getErrorStream()) {
                    if (stream != null) error = new JSONObject(new String(stream.readAllBytes(),StandardCharsets.UTF_8)).optString("error", error);
                } catch (Exception ignored) { }
                throw new IOException(error);
            }
            try (var stream = connection.getInputStream()) { return stream.readAllBytes(); }
        } finally { connection.disconnect(); }
    }

    private void clear() {
        token = null;
        storage.edit().remove("token").apply();
    }

    private static String urlEncode(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.NO_PADDING | Base64.NO_WRAP | Base64.URL_SAFE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS,null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }

    private void save(String field, String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE,key());
        String entry = urlEncode(cipher.getIV()) + "." + urlEncode(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        storage.edit().putString(field,entry).apply();
    }

    private String read(String field) {
        try {
            String entry = storage.getString(field,null);
            if (entry == null) return null;
            String[] parts = entry.split("\\.",2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.URL_SAFE)));
            return new String(cipher.doFinal(Base64.decode(parts[1],Base64.URL_SAFE)),StandardCharsets.UTF_8);
        } catch (Exception e) { return null; }
    }
}
