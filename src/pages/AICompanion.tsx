import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { aiChat } from '../lib/api'
import type { ChatMessage, Pet } from '../lib/types'

export default function AICompanion() {
  const { petId } = useParams<{ petId: string }>()
  const [pet, setPet] = useState<Pet | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!petId) return
    let active = true
    Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase
        .from('ai_conversations')
        .select('messages')
        .eq('pet_id', petId)
        .maybeSingle(),
    ]).then(([petRes, convRes]) => {
      if (!active) return
      setPet(petRes.data)
      setMessages((convRes.data?.messages as ChatMessage[]) ?? [])
    })
    return () => {
      active = false
    }
  }, [petId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!petId || !input.trim() || sending) return
    const message = input.trim()
    setInput('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: message }])
    setSending(true)
    try {
      const { reply } = await aiChat(petId, message)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The companion is unavailable right now.',
      )
      // Roll back the optimistic user message marker by keeping it; surface error.
    } finally {
      setSending(false)
    }
  }

  if (!pet) return <p className="text-brand-600">Loading…</p>

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-2xl flex-col">
      <div className="mb-3">
        <Link to={`/pets/${pet.id}`} className="text-sm text-brand-600 hover:text-brand-800">
          ← {pet.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">
          {pet.name}'s AI Companion
        </h1>
        <p className="text-sm text-brand-600">
          Dog-care expert{pet.breed ? ` for ${pet.breed}s` : ''}, grounded in{' '}
          {pet.name}'s profile and records.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-brand-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-base font-semibold text-brand-900">
              Ask about {pet.name}
            </p>
            <p className="mt-2 max-w-sm text-sm text-brand-600">
              Coat care, grooming cycles, nutrition, training, or whether
              something looks normal — answered from {pet.name}'s profile and
              health records.
            </p>
            <p className="mt-3 max-w-sm text-xs text-brand-500">
              Helpful guidance, not a replacement for your veterinarian.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-brand-100 text-brand-900'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-brand-100 px-4 py-2 text-sm text-brand-600">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${pet.name}…`}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary">
          Send
        </button>
      </form>
    </div>
  )
}
