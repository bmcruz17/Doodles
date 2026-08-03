import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { addToCart, getCart, setQty, clearCart, type CartItem } from '../lib/cart'
import type { Product, ProductCategory } from '../lib/types'

const CATS: { key: ProductCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'food', label: 'Food' },
  { key: 'treats', label: 'Treats' },
  { key: 'supplements', label: 'Supplements' },
  { key: 'pharmacy', label: 'Pharmacy' },
]

export default function Shop() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [cat, setCat] = useState<ProductCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>(getCart())
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('category')
      .then(({ data }) => {
        setProducts(data ?? [])
        setLoading(false)
      })
    const sync = () => setCart(getCart())
    window.addEventListener('ph-cart', sync)
    return () => window.removeEventListener('ph-cart', sync)
  }, [])

  const shown = useMemo(
    () => (cat === 'all' ? products : products.filter((p) => p.category === cat)),
    [products, cat],
  )
  const count = cart.reduce((n, c) => n + c.qty, 0)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Shop</h1>
          <p className="text-sm text-brand-600">
            Vetted premium brands — real ingredients, no filler. Auto-ship &amp; save.
          </p>
        </div>
        <button onClick={() => setCartOpen(true)} className="btn-primary relative">
          Cart
          {count > 0 && (
            <span className="ml-1 rounded-full bg-white px-1.5 text-xs font-bold text-sky-700">
              {count}
            </span>
          )}
        </button>
      </div>

      <div className="my-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              cat === c.key
                ? 'bg-sky-600 text-white'
                : 'border border-brand-200 bg-white text-brand-700 hover:border-sky-400'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-brand-600">Loading catalog…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <div key={p.id} className="card flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                    {p.brand}
                  </p>
                  <h3 className="font-semibold leading-snug text-brand-900">{p.name}</h3>
                  {p.unit && <p className="text-xs text-brand-500">{p.unit}</p>}
                </div>
                {p.rx_required && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Rx
                  </span>
                )}
              </div>
              <p className="flex-1 text-sm text-brand-600">{p.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-brand-900">${Number(p.price).toFixed(2)}</span>
                  {p.subscribe_price && (
                    <span className="ml-2 text-xs text-emerald-700">
                      ${Number(p.subscribe_price).toFixed(2)} auto-ship
                    </span>
                  )}
                </div>
                <button
                  onClick={() =>
                    addToCart({
                      product_id: p.id,
                      brand: p.brand,
                      name: p.name,
                      price: Number(p.price),
                      rx_required: p.rx_required,
                    })
                  }
                  className="btn-ghost px-3 py-1 text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cartOpen && (
        <CartModal
          userId={user?.id ?? ''}
          cart={cart}
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  )
}

function CartModal({
  userId,
  cart,
  onClose,
}: {
  userId: string
  cart: CartItem[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const hasRx = cart.some((c) => c.rx_required)

  async function place(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || cart.length === 0) return
    setBusy(true)
    try {
      const { error } = await supabase.from('shop_orders').insert({
        user_id: userId,
        items: cart.map((c) => ({
          product_id: c.product_id,
          brand: c.brand,
          name: c.name,
          qty: c.qty,
          price: c.price,
        })),
        subtotal: Math.round(subtotal * 100) / 100,
        ship_name: name.trim() || null,
        ship_address: address.trim() || null,
        has_rx_items: hasRx,
        status: 'placed',
      })
      if (!error) {
        clearCart()
        setDone(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-2xl text-white">✓</div>
            <h2 className="mt-3 text-lg font-semibold text-brand-900">Order placed</h2>
            <p className="mt-1 text-sm text-brand-600">
              We'll coordinate fulfillment with our distributor
              {hasRx ? ' and verify your vet prescription for the Rx items' : ''}.
            </p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : cart.length === 0 ? (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-brand-900">Your cart is empty</h2>
            <button onClick={onClose} className="btn-ghost mt-4">Keep shopping</button>
          </div>
        ) : (
          <form onSubmit={place} className="space-y-3">
            <h2 className="text-lg font-semibold text-brand-900">Your cart</h2>
            {cart.map((c) => (
              <div key={c.product_id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-brand-900">{c.name}</p>
                  <p className="text-xs text-brand-500">{c.brand} · ${c.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setQty(c.product_id, c.qty - 1)} className="h-6 w-6 rounded border border-brand-200">−</button>
                  <span className="w-5 text-center">{c.qty}</span>
                  <button type="button" onClick={() => setQty(c.product_id, c.qty + 1)} className="h-6 w-6 rounded border border-brand-200">+</button>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t border-brand-200 pt-2 text-sm font-semibold">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {hasRx && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                Your cart has prescription items. We'll verify your vet's Rx before shipping.
              </p>
            )}
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ship-to name" />
            <textarea className="input min-h-[60px]" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shipping address" />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? 'Placing…' : 'Place order'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">Close</button>
            </div>
            <p className="text-center text-xs text-brand-500">
              Payments (Stripe) land next — orders are coordinated manually for the pilot.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
