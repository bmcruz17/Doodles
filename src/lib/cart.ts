// Local cart persisted in localStorage. Emits 'ph-cart' so the nav/badge can
// react. Checkout turns this into a shop_orders row.
export type CartItem = {
  product_id: string
  brand: string
  name: string
  price: number
  qty: number
  rx_required: boolean
}

const KEY = 'ph_cart'

export function getCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function save(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('ph-cart'))
}

export function addToCart(item: Omit<CartItem, 'qty'>, qty = 1) {
  const cart = getCart()
  const found = cart.find((c) => c.product_id === item.product_id)
  if (found) found.qty += qty
  else cart.push({ ...item, qty })
  save(cart)
}

export function setQty(productId: string, qty: number) {
  let cart = getCart()
  if (qty <= 0) cart = cart.filter((c) => c.product_id !== productId)
  else cart = cart.map((c) => (c.product_id === productId ? { ...c, qty } : c))
  save(cart)
}

export function clearCart() {
  save([])
}

export function cartCount(): number {
  return getCart().reduce((n, c) => n + c.qty, 0)
}
