import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

// Registers the native app for push notifications and stores the APNs/FCM token
// so the backend can target this device. No-op on the web build (the plugin is
// native-only) — dynamic import keeps it out of the web bundle path.
export async function registerPush(userId: string) {
  if (!userId || !Capacitor.isNativePlatform()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token: token.value,
          platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android',
        },
        { onConflict: 'token' },
      )
    })
    PushNotifications.addListener('registrationError', (err) =>
      console.error('push registration error', err),
    )
  } catch (err) {
    console.error('push setup failed', err)
  }
}
