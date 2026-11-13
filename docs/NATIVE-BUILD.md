# Native apps

The iOS app uses SwiftUI and system frameworks. The Android app uses Android SDK views. Both use the same server-validated business actions and Postgres access rules as the website. The system browser handles Google or email sign-in, then hands a 90-second, single-use code back to the app. The code is bound to a random verifier kept on the device. The API stores only token hashes and checks the linked Neon session. The apps keep their session in Keychain or Android Keystore.

## Local build

- iOS 17 or later. Run `xcodegen generate` in `ios-native` and build the `FindAFlatmate` scheme. An unsigned device build can be packaged as an IPA for manual signing. The Simulator build can be installed with `xcrun simctl install booted FindAFlatmate.app`.
- Android 13 or later. With Java 17 and Android SDK 36 installed, run `./gradlew assembleDebug lintDebug` from `android-native`. The resulting debug APK is for preview. Build a release with a stable, private signing key for long-term distribution.
- The Native apps workflow compiles both platforms and uploads build artifacts. It does not consume paid Expo build credits.
- `/get` enables each download after a matching asset is available in the current GitHub release. Expected files are `find-a-flatmate-android.apk`, `find-a-flatmate-ios.ipa`, and `find-a-flatmate-ios-simulator.zip`.

## Release scope

The previews offer sign-in, profile and lifestyle, discovery, saved items, connections, chats, visits, listing management and reporting. Moderation, full data download and the public editorial pages remain on the website. Native store signing, publication, and full real-device journey checks are separate from build success.
