import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, request } from '../api.js'

export default function CartPage({ session }) {
  const [cart, setCart] = useState(null)
  const [error, setError] = useState('')
  const token = session?.user?.role === 'client' ? session.token : undefined
  const canCheckout = session?.user?.role === 'client'

  function load() {
    request('/cart', { token })
      .then(setCart)
      .catch((err) => setError(err.message))
  }

  useEffect(load, [token])

  async function update(id, quantity) {
    try {
      const next = await request(`/cart/items/${id}`, {
        method: 'PATCH',
        token,
        body: { quantity },
      })
      setCart(next)
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    try {
      const next = await request(`/cart/items/${id}`, { method: 'DELETE', token })
      setCart(next)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!cart) return <p className="wrap muted">Loading cart…</p>

  const hours = cart.hold_hours || 4

  return (
    <main className="panel wide">
      <h1>Cart</h1>
      {error ? <p className="error">{error}</p> : null}
      {cart.items.length === 0 ? (
        <p className="muted">
          Empty. <Link to="/">Shop shirts</Link>
        </p>
      ) : (
        <>
          <p className="muted">
            These items are held for {hours} hours. If you don&apos;t place an order, they go back to stock
            automatically.
          </p>
          {cart.items.map((item) => (
            <div className="cart-line" key={item.id}>
              <img src={item.image_url} alt="" />
              <div>
                <strong>{item.product_name}</strong>
                <p className="muted">
                  {item.color_name} · {item.size}
                </p>
                <div className="qty">
                  <button type="button" onClick={() => update(item.id, Math.max(1, item.quantity - 1))}>
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => update(item.id, item.quantity + 1)}>
                    +
                  </button>
                  <button type="button" className="link" onClick={() => remove(item.id)}>
                    Remove
                  </button>
                </div>
              </div>
              <div>{money(item.unit_price, cart.currency)}</div>
            </div>
          ))}
          <p>
            Subtotal <strong>{money(cart.subtotal, cart.currency)}</strong>
          </p>
          {canCheckout ? (
            <Link className="btn" to="/checkout">
              Checkout · pay before delivery
            </Link>
          ) : (
            <Link className="btn" to="/login" state={{ from: '/checkout' }}>
              Sign in to checkout
            </Link>
          )}
        </>
      )}
    </main>
  )
}
