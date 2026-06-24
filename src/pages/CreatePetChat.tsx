import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Json, Sex } from '../lib/types'

// --------------------------------------------------------------------------
// Parsing helpers (client-side — no LLM needed for the guided interview)
// --------------------------------------------------------------------------
function parseSex(s: string): Sex {
  const t = s.toLowerCase()
  if (/\b(boy|male|him|he|m)\b/.test(t)) return 'male'
  if (/\b(girl|female|her|she|f)\b/.test(t)) return 'female'
  return 'unknown'
}

function isSkip(s: string): boolean {
  return /^(no|nope|none|skip|n\/a|na|not sure|dunno|don'?t know|idk)\.?$/i.test(
    s.trim(),
  )
}

function parseWeight(s: string): number | null {
  const m = s.match(/(\d+(\.\d+)?)/)
  return m ? Number(m[1]) : null
}

// Accepts a date OR an age ("3 years", "6 months"), returns ISO date or null.
function parseBirthish(input: string): string | null {
  const s = input.trim()
  if (!s || isSkip(s)) return null
  const iso = (y: string, mo: string, d: string) => {
    const mn = Number(mo), dn = Number(d)
    if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  let m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (m) return iso(m[1], m[2], m[3])
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) return iso(m[3].length === 2 ? `20${m[3]}` : m[3], m[1], m[2])
  const digits = s.replace(/\D/g, '')
  if (/^\d{8}$/.test(digits))
    return iso(digits.slice(4), digits.slice(0, 2), digits.slice(2, 4))
  const yrs = s.match(/(\d+)\s*(years?|yrs?|yo|y)\b/i)
  const mos = s.match(/(\d+)\s*(months?|mos?|mo)\b/i)
  if (yrs || mos) {
    const now = new Date()
    const totalMonths = (yrs ? Number(yrs[1]) * 12 : 0) + (mos ? Number(mos[1]) : 0)
    if (totalMonths > 0)
      return new Date(now.getFullYear(), now.getMonth() - totalMonths, now.getDate())
        .toISOString()
        .slice(0, 10)
  }
  return null
}

// --------------------------------------------------------------------------
// Interview script
// --------------------------------------------------------------------------
type Chip = 'yes' | 'no' | 'unknown'

type Answers = {
  name: string
  breed: string | null
  sex: Sex
  birthdate: string | null
  weight_lbs: number | null
  coat_type: string | null
  source: string | null // where they got the dog
  acquired: string | null // when it joined the family
  wellbeing: string | null // general health / energy
  medical_history: string | null
  microchipped: Chip
  microchip_number: string | null
  notes: string | null
}

function parseChip(raw: string, a: Answers) {
  const t = raw.toLowerCase()
  const num = raw.match(/\d[\d\s-]{7,}\d/)
  if (num) {
    a.microchipped = 'yes'
    a.microchip_number = num[0].replace(/\D/g, '')
    return
  }
  if (/not chipped|no chip|isn'?t chipped|^no\b|nope|none/.test(t)) {
    a.microchipped = 'no'
    return
  }
  if (/\b(yes|yeah|yep|chipped|microchipped)\b/.test(t)) {
    a.microchipped = 'yes'
    return
  }
  a.microchipped = 'unknown'
}

type Step = {
  prompt: (a: Partial<Answers>) => string
  store: (raw: string, a: Answers) => void
  required?: boolean
  ack?: (a: Answers) => string
}

const STEPS: Step[] = [
  {
    required: true,
    prompt: () =>
      "Hi! I'm your PackHub companion 🐾 Let's build your dog's profile together. First — what's their name?",
    store: (raw, a) => (a.name = raw.trim()),
    ack: (a) => `Love it — nice to meet ${a.name}!`,
  },
  {
    prompt: (a) => `What breed or mix is ${a.name}? ("not sure" is fine.)`,
    store: (raw, a) => (a.breed = isSkip(raw) ? null : raw.trim()),
  },
  {
    prompt: (a) => `Is ${a.name} a boy or a girl?`,
    store: (raw, a) => (a.sex = parseSex(raw)),
  },
  {
    prompt: (a) =>
      `Roughly when was ${a.name} born? A date like 03/14/2021, an age like "3 years", or "skip".`,
    store: (raw, a) => (a.birthdate = parseBirthish(raw)),
  },
  {
    prompt: (a) => `About how much does ${a.name} weigh, in pounds?`,
    store: (raw, a) => (a.weight_lbs = parseWeight(raw)),
  },
  {
    prompt: (a) => `How would you describe ${a.name}'s coat? (short, curly, double… or "skip")`,
    store: (raw, a) => (a.coat_type = isSkip(raw) ? null : raw.trim()),
  },
  {
    prompt: (a) =>
      `Where did you get ${a.name}? (a breeder, a shelter or rescue, a friend, found them…)`,
    store: (raw, a) => (a.source = isSkip(raw) ? null : raw.trim()),
  },
  {
    prompt: (a) => `And when did ${a.name} join your family? (a year is fine, or "skip")`,
    store: (raw, a) => (a.acquired = isSkip(raw) ? null : raw.trim()),
  },
  {
    prompt: (a) =>
      `How's ${a.name}'s general health and energy these days? Anything you've noticed lately?`,
    store: (raw, a) => (a.wellbeing = isSkip(raw) ? null : raw.trim()),
  },
  {
    prompt: (a) =>
      `Any known medical history for ${a.name} — conditions, surgeries, medications, or allergies? ("none" is okay.)`,
    store: (raw, a) => (a.medical_history = isSkip(raw) ? null : raw.trim()),
  },
  {
    prompt: (a) =>
      `Is ${a.name} microchipped? If you have the number handy, say or type it — otherwise "not chipped" or "not sure".`,
    store: parseChip,
  },
  {
    prompt: (a) => `Last one — anything else I should know about ${a.name}?`,
    store: (raw, a) => (a.notes = isSkip(raw) ? null : raw.trim()),
  },
]

interface Bubble {
  from: 'bot' | 'user'
  text: string
}

const SpeechRecognition: any =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined

export default function CreatePetChat() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const answers = useRef<Answers>({
    name: '',
    breed: null,
    sex: 'unknown',
    birthdate: null,
    weight_lbs: null,
    coat_type: null,
    source: null,
    acquired: null,
    wellbeing: null,
    medical_history: null,
    microchipped: 'unknown',
    microchip_number: null,
    notes: null,
  })
  const [messages, setMessages] = useState<Bubble[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<'asking' | 'confirm'>('asking')
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [speak, setSpeak] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<any>(null)

  function say(text: string) {
    setMessages((m) => [...m, { from: 'bot', text }])
    if (speak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
    }
  }

  useEffect(() => {
    say(STEPS[0].prompt(answers.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || phase !== 'asking') return
    setInput('')
    setError(null)
    setMessages((m) => [...m, { from: 'user', text }])

    const step = STEPS[stepIndex]
    step.store(text, answers.current)

    const ack = step.ack?.(answers.current)
    const next = stepIndex + 1
    if (next < STEPS.length) {
      setStepIndex(next)
      const prompt = STEPS[next].prompt(answers.current)
      say(ack ? `${ack} ${prompt}` : prompt)
    } else {
      setPhase('confirm')
      say(
        `${ack ? ack + ' ' : ''}That's everything — here's ${answers.current.name}'s profile. Want me to save it?`,
      )
    }
  }

  function toggleListen() {
    if (!SpeechRecognition) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (ev: any) => {
      const said = ev.results[0][0].transcript
      setInput((prev) => (prev ? `${prev} ${said}` : said))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  async function createPet() {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const a = answers.current
      const ai_profile: Json = {
        source: a.source,
        acquired: a.acquired,
        wellbeing: a.wellbeing,
        medical_history: a.medical_history,
        microchip: { status: a.microchipped, number: a.microchip_number },
        intake_at: new Date().toISOString(),
      }

      const { data, error: insertError } = await supabase
        .from('pets')
        .insert({
          owner_id: user.id,
          name: a.name,
          breed: a.breed,
          coat_type: a.coat_type,
          birthdate: a.birthdate,
          weight_lbs: a.weight_lbs,
          sex: a.sex,
          photo_url: null,
          notes: a.notes,
          ai_profile,
        })
        .select()
        .single()
      if (insertError) throw insertError

      // Seed the health vault with any medical history they shared at intake.
      if (a.medical_history) {
        await supabase.from('health_records').insert({
          pet_id: data.id,
          record_type: 'note',
          data: { title: 'Known history (from intake)', notes: a.medical_history },
          document_url: null,
        })
      }

      navigate(`/pets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile')
    } finally {
      setBusy(false)
    }
  }

  const a = answers.current
  const chipText =
    a.microchipped === 'yes'
      ? a.microchip_number
        ? `Yes · ${a.microchip_number}`
        : 'Yes'
      : a.microchipped === 'no'
        ? 'Not chipped'
        : 'Unknown'
  const summary: [string, string][] = [
    ['Name', a.name || '—'],
    ['Breed', a.breed || '—'],
    ['Sex', a.sex],
    ['Birthday', a.birthdate || 'not set'],
    ['Weight', a.weight_lbs ? `${a.weight_lbs} lbs` : '—'],
    ['Coat', a.coat_type || '—'],
    ['From', a.source || '—'],
    ['Joined', a.acquired || '—'],
    ['Microchip', chipText],
  ]

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            Let's meet your dog
          </h1>
          <p className="text-sm text-brand-600">
            Answer by voice or text — I'll build the profile.
          </p>
        </div>
        {'speechSynthesis' in window && (
          <button onClick={() => setSpeak((s) => !s)} className="btn-ghost text-sm">
            {speak ? 'Voice on' : 'Voice off'}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-brand-200 bg-white p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.from === 'user' ? 'bg-sky-600 text-white' : 'bg-brand-100 text-brand-900'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {phase === 'confirm' && (
          <div className="card">
            <h3 className="mb-2 font-semibold text-brand-900">{a.name}'s profile</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {summary.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-brand-500">{k}</dt>
                  <dd className="text-sm text-brand-800">{v}</dd>
                </div>
              ))}
            </dl>
            {a.wellbeing && (
              <p className="mt-3 text-sm text-brand-700">
                <span className="font-medium">Wellbeing:</span> {a.wellbeing}
              </p>
            )}
            {a.medical_history && (
              <p className="mt-1 text-sm text-brand-700">
                <span className="font-medium">History:</span> {a.medical_history}
              </p>
            )}
            {a.notes && (
              <p className="mt-3 border-t border-brand-200 pt-3 text-sm text-brand-700">
                {a.notes}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button onClick={createPet} disabled={busy} className="btn-primary">
                {busy ? 'Saving…' : `Save ${a.name}'s profile`}
              </button>
              <Link to="/pets/new/form" className="btn-ghost">
                Edit as a form
              </Link>
            </div>
            <p className="mt-2 text-xs text-brand-500">
              You can add a photo on the next screen.
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {phase === 'asking' && (
        <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
          {SpeechRecognition && (
            <button
              type="button"
              onClick={toggleListen}
              className={`btn ${listening ? 'bg-red-500 text-white' : 'btn-ghost'} px-3`}
              title={listening ? 'Stop listening' : 'Speak your answer'}
            >
              {listening ? '● Listening' : '🎤'}
            </button>
          )}
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer…"
            autoFocus
          />
          <button type="submit" disabled={!input.trim()} className="btn-primary">
            Send
          </button>
        </form>
      )}

      <p className="mt-2 text-center text-xs text-brand-500">
        Prefer a plain form?{' '}
        <Link to="/pets/new/form" className="underline hover:text-brand-700">
          Use the quick form
        </Link>
      </p>
    </div>
  )
}
