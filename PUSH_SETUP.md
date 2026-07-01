# Push Notifications (OneSignal) — Setup

Client code is already wired (`src/api/onesignal.js` + App.jsx). It stays a
**no-op** until the steps below are done, so the app ships safely meanwhile.

## What the code already does
- Registers the device with OneSignal on native launch, asks iOS permission.
- Links the push subscription to the logged-in user (external id = phone),
  so you can target a specific customer later.
- On notification tap, navigates to `additionalData.screen`
  (`myorders` / `cart` / `catalog` / `profile`).

## You do (one-time)

### 1. OneSignal account
- Create a free account → **New App/Website** → **Apple iOS (APNs)**.
- Bundle ID: `kg.kemalusman.parfum`.
- Copy the **OneSignal App ID**.

### 2. APNs key (Apple Developer)
- developer.apple.com → Certificates, IDs & Profiles → **Keys** → **+**
- Enable **Apple Push Notifications service (APNs)** → download the **.p8** file.
- Note the **Key ID** and your **Team ID**.
- In OneSignal → iOS setup → upload the `.p8`, enter Key ID + Team ID + bundle id.

### 3. App config
- Add the App ID to `.env`:
  ```
  VITE_ONESIGNAL_APP_ID=your-onesignal-app-id
  ```

### 4. Install plugin + sync (on Mac)
```bash
npm install
npx cap sync ios
```

### 5. Xcode capabilities
- App target → **Signing & Capabilities**:
  - **+ Push Notifications**
  - **+ Background Modes** → check **Remote notifications**

### 6. Build & test on a REAL device
- Remote push needs a real iPhone (or iOS 16+ simulator).
- Rebuild, allow the permission prompt.
- OneSignal dashboard → **Messages → New Push** → send a test.
- It should appear as a native banner even with the app closed.

## Sending pushes
- **Manual:** OneSignal dashboard (promos, announcements).
- **Automatic (optional, I can wire next):** a PocketBase hook calls the
  OneSignal REST API when an order status changes — e.g. "Заказ доставляется 🚚".
  Needs your OneSignal **REST API Key**.
