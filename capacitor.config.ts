import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor wraps the built web app (dist/) in a native iOS/Android shell so we
// can ship to the App Store and Google Play. The web build is the single source
// of truth — `npx cap sync` copies dist/ into the native projects.
//
// For day-to-day native dev you can point `server.url` at a running dev server,
// but for store builds we ship the bundled dist/ (leave server unset).
const config: CapacitorConfig = {
  appId: 'com.packhub.app',
  appName: 'PackHub',
  webDir: 'dist',
  backgroundColor: '#faf6ef',
  ios: {
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#faf6ef',
  },
}

export default config
