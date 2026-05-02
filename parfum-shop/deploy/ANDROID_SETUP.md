# Android — first-time Capacitor setup

The project ships with iOS only (`@capacitor/ios`) — Android needs to be
added on your Mac (Capacitor needs a JDK + Android SDK installed).

---

## 1. Install dependencies

```bash
# JDK 17 + Android Studio (only needed once on your machine)
brew install --cask zulu@17
brew install --cask android-studio
# Open Android Studio once → Tools → SDK Manager → install API 34, Build Tools 34.0.0
```

## 2. Add the Android platform

```bash
cd /Users/doniyorabduganiev/kemal-usman/parfum-shop
npm install @capacitor/android@^8.3.1
npm run build
npx cap add android
npx cap sync android
```

After this you'll have an `android/` folder.

## 3. Required edits to `android/app/src/main/AndroidManifest.xml`

```xml
<!-- HTTPS only (after backend migration) — keep cleartext OFF for Play Store -->
<application
    android:usesCleartextTraffic="false"
    ...>

    <!-- M-Bank / O!Bank deep links -->
    <queries>
        <package android:name="kg.mbank.app" />
        <package android:name="kg.obank.app" />
        <package android:name="com.whatsapp" />
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
    </queries>
</application>

<!-- Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

## 4. Target SDK 34 (required by Play Store from Aug 2024)

Edit `android/variables.gradle`:

```gradle
ext {
    minSdkVersion = 23
    compileSdkVersion = 34
    targetSdkVersion = 34
    androidxAppCompatVersion = '1.6.1'
    androidxCoreVersion = '1.12.0'
}
```

## 5. App icons

```bash
# After installing capacitor-resources:
npm i -D @capacitor/assets
npx capacitor-assets generate --android
```

## 6. Build a release AAB

```bash
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Sign with your upload key (Play App Signing handles the rest):

```bash
keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
# Save the password — required for every upload
```

Add to `android/app/build.gradle`:

```gradle
signingConfigs {
    release {
        keyAlias 'upload'
        keyPassword System.getenv('UPLOAD_KEY_PASSWORD')
        storeFile file('../keystore/upload.jks')
        storePassword System.getenv('UPLOAD_KEYSTORE_PASSWORD')
    }
}
```

## 7. Play Console — Data Safety form

Declare:
- Personal info: Name, Phone, Address — Collected, Not Shared, Required for app function
- Location: Approximate — Collected with consent, Not Shared
- Audio: Voice recordings — Admin only, Not Shared
- Purchase history — Collected, Not Shared

## 8. Privacy policy URL

Paste the public HTTPS URL of your privacy policy in
Play Console → App content → Privacy policy.
