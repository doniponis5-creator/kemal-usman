# iOS — Info.plist required changes

Open `ios/App/App/Info.plist` in Xcode (or any text editor) and apply the
patches below before submitting to App Store Connect. Apple **will reject**
the build if any of these are missing.

---

## 1. App Transport Security — REMOVE any HTTP exception

If a previous version had `NSAppTransportSecurity` with
`NSAllowsArbitraryLoads = true`, **delete that whole entry**. After the Caddy
migration the backend is HTTPS, so no exceptions are needed. Apple penalizes
arbitrary-loads exceptions in the review.

```xml
<!-- DELETE THIS WHOLE BLOCK IF PRESENT -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

## 2. Permission usage strings (REQUIRED)

Add the following keys. Without them, the OS auto-rejects any
`getUserMedia` / `geolocation` call and the app silently breaks.

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Микрофон используется только администратором для записи аудио-описания товара. Обычные пользователи доступ не предоставляют.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Геолокация используется для автоматического определения адреса доставки. Координаты не сохраняются.</string>

<key>NSCameraUsageDescription</key>
<string>Камера используется для съёмки фотографии товара или баннера в админ-панели.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Доступ к фото нужен для выбора изображения товара или баннера.</string>
```

## 3. URL Schemes (M-Bank / O!Bank deep links)

Required so iOS lets the app open `mbank://` and `obank://` URLs.

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>mbank</string>
    <string>obank</string>
    <string>whatsapp</string>
    <string>tel</string>
</array>
```

## 4. Status bar style (matches the dark login screen)

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>
```

## 5. App icons & launch screen

- `ios/App/App/Assets.xcassets/AppIcon.appiconset/` — replace placeholder
  with 1024×1024 + all the size variants. Use Bakery / Icon-Generator app.
- `ios/App/App/Assets.xcassets/Splash.imageset/` — replace with your hero.

## 6. Privacy nutrition label (App Store Connect)

In App Store Connect → App Privacy, declare:

| Data type | Linked to user | Used for tracking | Purpose |
|---|---|---|---|
| Name | Yes | No | App functionality |
| Phone number | Yes | No | App functionality, customer support |
| Coarse location | Yes | No | App functionality (delivery address) |
| Audio data | Yes | No | App functionality (admin only) |
| Purchase history | Yes | No | App functionality, analytics |

## 7. Account deletion (Apple guideline 5.1.1.v)

Apple **requires** apps that allow account creation to provide an in-app
account-deletion flow. Already implemented:
- Backend: `/api/custom/account/delete` (see `pb_hooks/main.pb.js`).
- Frontend: button in Profile screen → calls `deleteAccount()` from
  `src/api/auth.js`. Make sure this button ships in the production build.

## 8. Privacy policy URL

In App Store Connect → App Information, paste the public URL of your
Privacy Policy (host the file from `legal/PRIVACY_POLICY_RU.md` rendered as
HTML at e.g. `https://kemalusman.kg/privacy`).
