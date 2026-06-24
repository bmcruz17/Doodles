import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Sex } from '../lib/types'

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

// Accepts a date (MM/DD/YYYY, YYYY-MM-DD, bare digits) OR an age ("3 years",
// "6 months", "2 yo"), returning an ISO date or null.
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

  // Age → approximate birthdate from today.
  const yrs = s.match(/(\d+)\s*(years?|yrs?|yo|y)\b/i)
  const mos = s.match(/(\d+)\s*(months?|mos?|mo)\b/i)
  if (yrs || mos) {
    const now = new Date()
    let totalMonths = (yrs ? Number(yrs[1]) * 12 : 0) + (mos ? Number(mos[1]) : 0)
    if (totalMonths > 0) {
      const d = new Date(now.getFullYear(), now.getMonth() - totalMonths, now.getDate())
      return d.toISOString().slice(0, 10)
    }
  }
  return null
}

// --------------------------------------------------------------------------
// Interview script
// --------------------------------------------------------------------------
type Answers = {
  name: string
  breed: string | null
  sex: Sex
  birthdate: string | null
  weight_lbs: number | null
  coat_type: string | null
  notes: string | null
}

type Step = {
  key: keyof Answers
  required?: boolean
  prompt: (a: Partial<Answers>) => string
  store: (raw: string, a: Answers) => void
  ack?: (a: Answers) => string
}

const STEPS: Step[] = [
  {
    key: 'name',
    required: true,
    prompt: () =>
      "Hi! I'm your PackHub companion 🐾 Let's build your dog's profile together. First — what's their name?",
    store: (raw, a) => (a.name = raw.trim()),
    ack: (a) => `Love it — nice to meet ${a.name}!`,
  },
  {
    key: 'breed',
    prompt: (a) => `What breed or mix is ${a.name}? (You can say "not sure.")`,
    store: (raw, a) => (a.breed = isSkip(raw) ? null : raw.trim()),
  },
  {
    key: 'sex',
    prompt: (a) => `Is ${a.name} a boy or a girl?`,
    store: (raw, a) => (a.sex = parseSex(raw)),
  },
  {
    key: 'birthdate',
    prompt: (a) =>
      `Roughly when was ${a.name} born? A date like 03/14/2021, or an age like "3 years" — or "skip".`,
    store: (raw, a) => (a.birthdate = parseBirthish(raw)),
  },
  {
    key: 'weight_lbs',
    prompt: (a) => `About how much does ${a.name} weigh, in pounds?`,
    store: (raw, a) => (a.weight_lbs = parseWeight(raw)),
  },
  {
    key: 'coat_type',
    prompt: (a) =>
      `How would you describe ${a.name}'s coat? (short, curly, double… or "skip")`,
    store: (raw, a) => (a.coat_type = isSkip(raw) ? null : raw.trim()),
  },
  {
    key: 'notes',
    prompt: (a) =>
      `Last one — anything else I should know about ${a.name}? Allergies, quirks, health notes — or "nope".`,
    store: (raw, a) => (a.notes = isSkip(raw) ? null : raw.trim()),
  },
]

interface Bubble {
  from: 'bot' | 'user'
  text: string
}

// Browser speech recognition (Chrome/Edge; degrades gracefully elsewhere).
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

  // Kick off with the first question.
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
    if (step.required && !text) {
      say(step.prompt(answers.current))
      return
    }
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
        `${ack ? ack + ' ' : ''}That's everything I need. Here's ${answers.current.name}'s profile — want me to save it?`,
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
        })
        .select()
        .single()
      if (insertError) throw insertError
      navigate(`/pets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile')
    } finally {
      setBusy(false)
    }
  }

  const a = answers.current
  const summary: [string, string][] = [
    ['Name', a.name || '—'],
    ['Breed', a.breed || '—'],
    ['Sex', a.sex],
    ['Birthday', a.birthdate || 'not set'],
    ['Weight', a.weight_lbs ? `${a.weight_lbs} lbs` : '—'],
    ['Coat', a.coat_type || '—'],
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
          <button
            onClick={() => setSpeak((s) => !s)}
            className="btn-ghost text-sm"
            title="Read questions aloud"
          >
            {speak ? 'Voice on' : 'Voice off'}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-brand-200 bg-white p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.from === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-brand-100 text-brand-900'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {phase === 'confirm' && (
          <div className="card">
            <h3 className="mb-2 font-semibold text-brand-900">
              {a.name}'s profile
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              {summary.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-brand-500">{k}</dt>
                  <dd className="text-sm text-brand-800">{v}</dd>
                </div>
              ))}
            </dl>
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
