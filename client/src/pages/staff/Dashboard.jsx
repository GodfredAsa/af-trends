import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { money, request, statusLabel } from '../../api.js'
import { IconBell, IconChat, IconCheck, IconFingerprint, IconSearch } from '../../components/Icons.jsx'

function amount(value) {
  return Number(value || 0)
}

function roundMoney(value) {
  return value.toFixed(2)
}

function sameMonth(date, ref) {
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth()
}

function startOfDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function lastDays(count) {
  const days = []
  const today = startOfDay(new Date())
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = new Date(today)
    day.setDate(today.getDate() - i)
    days.push(day)
  }
  return days
}

function seriesFromOrders(orders, days) {
  return days.map((day) => {
    const key = day.toDateString()
    return orders
      .filter((order) => order.status !== 'cancelled' && new Date(order.created_at).toDateString() === key)
      .reduce((sum, order) => sum + amount(order.total), 0)
  })
}

function BarSpark({ values }) {
  const max = Math.max(...values, 1)
  return (
    <svg className="spark" viewBox="0 0 88 36" aria-hidden="true">
      {values.map((value, index) => {
        const height = Math.max(4, (value / max) * 32)
        return (
          <rect
            key={index}
            x={index * 12 + 2}
            y={36 - height}
            width="8"
            height={height}
            rx="3"
            fill="#D9E4D7"
          />
        )
      })}
    </svg>
  )
}

function LineSpark({ values, stroke = '#2A3B30' }) {
  const max = Math.max(...values, 1)
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 44 : (index / (values.length - 1)) * 88
      const y = 32 - (value / max) * 26
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg className="spark" viewBox="0 0 88 36" aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" points={points} />
    </svg>
  )
}

function AreaChart({ values }) {
  const max = Math.max(...values, 1)
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100
    const y = 86 - (value / max) * 62
    return [x, y]
  })
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `0,90 ${line} 100,90`
  return (
    <svg className="area-chart" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="rgba(107,142,125,0.18)" stroke="none" points={area} />
      <polyline fill="none" stroke="#6B8E7D" strokeWidth="1.4" points={line} />
    </svg>
  )
}

function Gauge({ percent }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const angle = Math.PI * (1 - clamped / 100)
  const x = 60 + Math.cos(angle) * 42
  const y = 58 - Math.sin(angle) * 42
  return (
    <svg className="gauge" viewBox="0 0 120 78" aria-hidden="true">
      <path d="M18 58 A42 42 0 0 1 102 58" fill="none" stroke="#E8EBE3" strokeWidth="10" strokeLinecap="round" />
      <path d="M18 58 A42 42 0 0 1 102 58" fill="none" stroke="#2A3B30" strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray={`${clamped} 100`} />
      <circle cx={x} cy={y} r="5" fill="#2A3B30" />
      <text x="60" y="54" textAnchor="middle" fontSize="16" fontWeight="700" fill="#1c241e">
        {clamped}%
      </text>
    </svg>
  )
}

function initials(name) {
  return (name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function StaffDashboard({ session }) {
  const navigate = useNavigate()
  const role = session.user.role
  const isAdmin = role === 'superadmin'
  const canCatalog = role === 'manager' || isAdmin
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    request('/staff/orders?page_size=100', { token: session.token })
      .then((data) => setOrders(data.items || []))
      .catch(() => {})
    if (canCatalog) {
      request('/staff/products?page_size=50', { token: session.token })
        .then((data) => setProducts(data.items || []))
        .catch(() => {})
    }
    if (isAdmin) {
      request('/staff/users?page_size=100', { token: session.token })
        .then((data) => setUsers(data.items || []))
        .catch(() => {})
    }
  }, [session.token, canCatalog, isAdmin])

  const recent = useMemo(() => {
    const term = query.trim().toLowerCase()
    return orders
      .filter((order) => {
        if (!term) return true
        return `${order.order_number} ${order.customer?.full_name || ''} ${order.status}`.toLowerCase().includes(term)
      })
      .slice(0, 5)
  }, [orders, query])

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const active = orders.filter((order) => order.status !== 'cancelled')
  const monthOrders = active.filter((order) => sameMonth(new Date(order.created_at), now))
  const prevMonthOrders = active.filter((order) => sameMonth(new Date(order.created_at), lastMonth))
  const monthTotal = monthOrders.reduce((sum, order) => sum + amount(order.total), 0)
  const prevTotal = prevMonthOrders.reduce((sum, order) => sum + amount(order.total), 0)
  const paid = active.filter((order) => order.payment_status === 'paid')
  const paidTotal = paid.reduce((sum, order) => sum + amount(order.total), 0)
  const unpaid = active.filter((order) => order.payment_status === 'unpaid')
  const unpaidTotal = unpaid.reduce((sum, order) => sum + amount(order.total), 0)
  const pending = orders.filter((order) => order.status === 'pending')
  const delivered = orders.filter((order) => order.status === 'delivered')
  const clients = users.filter((user) => user.role === 'client')
  const staffCount = users.filter((user) => user.role !== 'client').length
  const published = products.filter((product) => product.is_published).length
  const fulfillment = active.length ? Math.round((delivered.length / active.length) * 100) : 0
  const collectedShare = monthTotal ? Math.round((paid.filter((order) => sameMonth(new Date(order.created_at), now)).reduce((sum, order) => sum + amount(order.total), 0) / monthTotal) * 10000) / 100 : 0
  const monthChange = prevTotal ? ((monthTotal - prevTotal) / prevTotal) * 100 : monthTotal ? 100 : 0
  const paidChange = paidTotal && unpaidTotal ? ((paidTotal - unpaidTotal) / (paidTotal + unpaidTotal)) * 100 : 0
  const days = lastDays(7)
  const weekSeries = seriesFromOrders(active, days)
  const firstName = (session.user.full_name || 'there').split(' ')[0]

  function submitSearch(event) {
    event.preventDefault()
    navigate('/staff/orders')
  }

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <h1>Hello, {firstName}!</h1>
          <p>Explore orders, cash on delivery, and catalog activity for AF Trends.</p>
        </div>
        <div className="dash-tools">
          <form className="dash-search" onSubmit={submitSearch}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search orders"
              aria-label="Search orders"
            />
            <button type="submit" aria-label="Search">
              <IconSearch />
            </button>
          </form>
          <Link className="dash-icon" to="/staff/orders" aria-label="Orders">
            <IconChat />
            {pending.length ? <span className="dash-dot" /> : null}
          </Link>
          <Link className="dash-icon" to="/staff/orders" aria-label="Unpaid COD">
            <IconBell />
            {unpaid.length ? <span className="dash-dot" /> : null}
          </Link>
        </div>
      </header>

      <section className="dash-metrics">
        <article className="dash-card">
          <p>Orders this month</p>
          <strong>{money(roundMoney(monthTotal))}</strong>
          <BarSpark values={weekSeries} />
        </article>
        <article className="dash-card">
          <p>New clients</p>
          <strong>{isAdmin ? clients.length : active.length}</strong>
          <LineSpark values={weekSeries} />
        </article>
        <article className="dash-card">
          <p>COD collected</p>
          <strong>{money(roundMoney(paidTotal))}</strong>
          <span className="dash-coin" aria-hidden="true">
            GHS
          </span>
        </article>
        <article className="dash-card accent">
          <p>Open COD</p>
          <strong>{money(roundMoney(unpaidTotal))}</strong>
          <LineSpark values={weekSeries} stroke="#ffffff" />
        </article>
      </section>

      <section className="dash-mid">
        <article className="dash-card balance">
          <div className="balance-head">
            <h2>Balance</h2>
            <span className="on-track">
              <IconCheck /> {fulfillment >= 50 ? 'On track' : 'Needs attention'}
            </span>
            <span className="range">Last 7 days</span>
          </div>
          <div className="balance-stats">
            <div>
              <p>Collected</p>
              <b>{collectedShare}%</b>
              <span className={monthChange >= 0 ? 'up' : 'down'}>
                {monthChange >= 0 ? '+' : ''}
                {monthChange.toFixed(2)}%
              </span>
            </div>
            <div>
              <p>Paid total</p>
              <b>{money(roundMoney(paidTotal))}</b>
              <span className={paidChange >= 0 ? 'up' : 'down'}>
                {paidChange >= 0 ? '+' : ''}
                {paidChange.toFixed(2)}%
              </span>
            </div>
          </div>
          <AreaChart values={weekSeries} />
        </article>
        <article className="dash-card gauge-card">
          <p>Total unpaid</p>
          <strong>{money(roundMoney(unpaidTotal))}</strong>
          <p className="muted">
            {fulfillment}% of active orders are delivered. {pending.length} still pending confirm.
          </p>
          <Gauge percent={fulfillment} />
        </article>
        <article className="dash-card profile-card">
          <div className="profile-avatar">{initials(session.user.full_name)}</div>
          <h2>{session.user.full_name}</h2>
          <p>{session.user.email}</p>
          <div className="profile-stats">
            <div>
              <b>{published || products.length}</b>
              <span>Shirts</span>
            </div>
            <div>
              <b>{isAdmin ? clients.length : unpaid.length}</b>
              <span>{isAdmin ? 'Clients' : 'Unpaid'}</span>
            </div>
            <div>
              <b>{isAdmin ? staffCount : pending.length}</b>
              <span>{isAdmin ? 'Staff' : 'Pending'}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="dash-bottom">
        <article className="dash-card wallet">
          <div>
            <h2>Cash on delivery in flight</h2>
            <p>
              {unpaid.length} open orders still unpaid. Collect cash when the drop-off is marked delivered.
            </p>
            <Link className="dash-btn" to="/staff/orders">
              Review orders +
            </Link>
          </div>
          <div className="stack-cards" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </article>
        <article className="dash-card transfers">
          <h2>Recent orders</h2>
          {recent.length === 0 ? <p className="muted">No orders yet.</p> : null}
          <ul>
            {recent.map((order) => (
              <li key={order.id}>
                <Link to={`/staff/orders/${order.id}`}>
                  <strong>{order.customer.full_name}</strong>
                  <span>
                    {order.order_number} · {statusLabel(order.status)}
                  </span>
                </Link>
                <em className={order.payment_status === 'paid' ? 'up' : 'down'}>
                  {order.payment_status === 'paid' ? '+' : ''}
                  {money(order.total)}
                </em>
              </li>
            ))}
          </ul>
        </article>
        {isAdmin ? (
          <article className="dash-card security">
            <IconFingerprint />
            <h2>Keep the store safe</h2>
            <p>Review staff accounts, delivery zones, and the cash-on-delivery note.</p>
            <Link className="dash-btn" to="/staff/settings">
              Update settings
            </Link>
          </article>
        ) : (
          <article className="dash-card security">
            <IconFingerprint />
            <h2>Fulfillment</h2>
            <p>{pending.length} orders waiting. Move confirmed shirts toward delivery.</p>
            <Link className="dash-btn" to="/staff/orders">
              Open orders
            </Link>
          </article>
        )}
      </section>
    </div>
  )
}
