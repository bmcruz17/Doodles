import { supabase } from './supabase'

// Generate ~14 days of plausible wearable data so the dashboard + AI work
// before real hardware exists. We bake in a slight rising limp/scratch trend in
// the last few days so the AI analysis has a realistic signal to surface.
export async function generateSampleData(petId: string, deviceId: string) {
  const days = 14
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const recent = i <= 3 // last few days drift
    const jitter = (base: number, spread: number) =>
      Math.round(base + (Math.random() - 0.5) * spread)
    rows.push({
      pet_id: petId,
      device_id: deviceId,
      day: d.toISOString().slice(0, 10),
      steps: jitter(recent ? 6200 : 9000, 1500),
      distance_m: jitter(recent ? 3200 : 4800, 800),
      active_minutes: jitter(recent ? 55 : 85, 20),
      rest_minutes: jitter(640, 60),
      sleep_minutes: jitter(recent ? 690 : 640, 50),
      avg_heart_rate: jitter(recent ? 92 : 80, 8),
      avg_resp_rate: jitter(recent ? 26 : 21, 4),
      water_ml: jitter(recent ? 760 : 900, 120),
      food_g: jitter(recent ? 280 : 320, 40),
      scratch_events: jitter(recent ? 34 : 12, 8),
      limp_score: Number((recent ? 0.35 + Math.random() * 0.25 : Math.random() * 0.12).toFixed(2)),
      play_minutes: jitter(recent ? 22 : 40, 12),
    })
  }
  const { error } = await supabase
    .from('device_daily')
    .upsert(rows, { onConflict: 'pet_id,day' })
  if (error) throw error
}
