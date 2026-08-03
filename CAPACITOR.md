# Native apps (iOS + Android) with Capacitor

PackHub is a web app first. Capacitor wraps the exact same built web bundle
(`dist/`) in a native shell so we can ship to the **App Store** and **Google
Play**. There is no separate codebase — `npx cap sync` copies `dist/` into the
native projects after every `npm run build`.

## One-time setup (do this on a Mac for iOS)

```bash
# 1. Install the Capacitor deps already listed in package.json
npm install

# 2. Add the native platforms (creates ios/ and android/ folders)
npx cap add ios
npx cap add android

# 3. Build the web app and copy it into the native shells
npm run cap:sync
```

Requirements:
- **iOS:** a Mac with **Xcode** + an **Apple Developer Program** membership
  ($99/yr). Open with `npm run cap:ios`.
- **Android:** **Android Studio** (any OS) + a Google Play Developer account
  ($25 one-time). Open with `npm run cap:android`.

## Day-to-day

```bash
npm run cap:sync       # rebuild web + copy into both native projects
npm run cap:ios        # build, sync, open Xcode
npm run cap:android    # build, sync, open Android Studio
```

## Push notifications

`@capacitor/push-notifications` is installed and wired: on the native app, once a
user signs in, `registerPush()` (src/lib/push.ts) requests permission, registers
with APNs/FCM, and upserts the device token into the `push_tokens` table. It's a
no-op on the web build.

To finish enabling push (on your Mac / in the consoles):

**iOS**
1. In the Apple Developer portal, create an **APNs Auth Key (.p8)**.
2. In Xcode: target → Signing & Capabilities → add **Push Notifications** +
   **Background Modes → Remote notifications**.
3. Upload the APNs key to your push provider (or Firebase, if you route iOS
   through FCM).

**Android**
1. Create a Firebase project; add the Android app; download
   **`google-services.json`** into `android/app/`.
2. Capacitor's FCM wiring is automatic once the file is present.

**Sending** pushes needs a small backend sender (an Edge Function calling FCM/
APNs with your server key) — not built yet; the tokens are already being
collected so it's ready to add.

## Notes

- `ios/` and `android/` are generated native projects — they're gitignored by
  default. Commit them only if you want them version-controlled.
- The app loads the bundled `dist/`. Because the API layer talks to Supabase
  over HTTPS, no extra native networking config is needed.
- Camera (microchip/record scanning) uses the web `getUserMedia` API, which
  works inside the Capacitor WebView. If you later want native camera plugins,
  add `@capacitor/camera`.
- App icons / splash: generate with `@capacitor/assets` from a single
  1024×1024 source once we lock the brand mark.

## App Store reality check

A thin web wrapper risks **App Review Guideline 4.2** ("minimum
functionality"). Before submitting, make sure the native build leans on real
device capability — push notifications, camera, offline records — so it reads as
an app, not a bookmarked website. Google Play is faster and more lenient if you
want to launch there first.
