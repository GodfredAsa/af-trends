const SESSION_KEY = 'af-trends-session'
const CART_KEY = 'af-trends-cart-key'

function errorMessage(data, fallback) {
  const detail = data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  return fallback
}

export function cartKey() {
  try {
    let key = localStorage.getItem(CART_KEY)
    if (!key) {
      key = crypto.randomUUID()
      localStorage.setItem(CART_KEY, key)
    }
    return key
  } catch {
    return crypto.randomUUID()
  }
}

export async function request(path, { method = 'GET', token, body, form } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  headers['X-Cart-Key'] = cartKey()

  let response
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
  } catch {
    throw new Error('Unable to reach the server. Is the API running?')
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(errorMessage(data, 'Request failed.'))
  }
  return data
}

export function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const session = raw ? JSON.parse(raw) : null
    if (!session?.token) return null
    return session
  } catch {
    return null
  }
}

export function writeSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function isStaff(role) {
  return role === 'superadmin' || role === 'manager' || role === 'support'
}

export function money(value, currency = 'GHS') {
  return `${currency} ${value}`
}

export function statusLabel(value) {
  return String(value || '').replaceAll('_', ' ')
}

export function formatPlacedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
