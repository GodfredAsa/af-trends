import { useEffect, useState } from 'react'
import { request } from '../../api.js'
import { IconEye, IconMail, IconSearch, IconTrash } from '../../components/Icons.jsx'
import { PRIV, can } from '../../privileges.js'

const PAGE_SIZES = [10, 25, 50]

function formatSendTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayName(item) {
  if (item.customer_name) return item.customer_name
  const match = String(item.body || '').match(/Placed by:\s*(.+)/i)
  if (match?.[1]) return match[1].trim()
  return (item.recipients || '').split(',')[0] || 'Customer'
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function preview(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim()
  if (text.length <= 72) return text
  return `${text.slice(0, 72)}…`
}

function statusClass(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'sent' || value === 'delivered') return value
  if (value === 'failed') return 'failed'
  return 'queued'
}

function statusLabel(status) {
  const value = String(status || 'queued')
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function StaffNotifications({ session }) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState(null)
  const canDelete = can(session.user, PRIV.NOTIFICATIONS_DELETE)

  function load(nextPage = page, nextSize = pageSize, nextQuery = q) {
    const params = new URLSearchParams({
      page: String(nextPage),
      page_size: String(nextSize),
    })
    if (nextQuery.trim()) params.set('q', nextQuery.trim())
    request(`/staff/notifications?${params}`, { token: session.token })
      .then((data) => {
        setItems(data.items || [])
        setUnread(Number(data.unread) || 0)
        setTotal(Number(data.total) || 0)
        setPage(data.page || nextPage)
        setPageSize(data.page_size || nextSize)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load(page, pageSize, q)
  }, [session.token, page, pageSize, q])

  function changeQuery(value) {
    setQ(value)
    setPage(1)
  }

  function changePageSize(size) {
    setPageSize(size)
    setPage(1)
  }

  async function markRead(item) {
    if (item.is_read) return
    setBusy(`read-${item.id}`)
    setError('')
    try {
      const next = await request(`/staff/notifications/${item.id}/read`, {
        method: 'PATCH',
        token: session.token,
      })
      setItems((current) => current.map((row) => (row.id === next.id ? next : row)))
      setUnread((count) => Math.max(0, count - 1))
      setSelected((current) => (current?.id === next.id ? next : current))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function removeOne(item) {
    if (!window.confirm('Delete this SMS notification?')) return
    setBusy(`del-${item.id}`)
    setError('')
    try {
      await request(`/staff/notifications/${item.id}`, { method: 'DELETE', token: session.token })
      setSelected((current) => (current?.id === item.id ? null : current))
      const remaining = total - 1
      const lastPage = Math.max(1, Math.ceil(remaining / pageSize))
      const nextPage = Math.min(page, lastPage)
      setPage(nextPage)
      load(nextPage, pageSize, q)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(page * pageSize, total)

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <h1>Notifications</h1>
          <p>Outbound order SMS. {unread ? `${unread} unread.` : 'You are up to date.'}</p>
        </div>
        <form
          className="dash-search"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            load(1, pageSize, q)
          }}
        >
          <input
            value={q}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Search name, order, number, status"
            aria-label="Search notifications"
          />
          <button type="submit" aria-label="Search">
            <IconSearch />
          </button>
        </form>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {total > 0 ? (
        <div className="stock-toolbar">
          <p className="muted">
            Showing {from}–{to} of {total}
          </p>
          <div className="page-sizes" role="group" aria-label="Rows per page">
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={pageSize === size ? 'btn' : 'btn ghost'}
                onClick={() => changePageSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="inbox-card">
        <div className="inbox-head">
          <span>To</span>
          <span>Message</span>
          <span>Status</span>
          <span>Send time</span>
          <span />
        </div>
        {!items.length ? (
          <p className="muted inbox-empty">
            {q.trim() ? 'No notifications match that search.' : 'No SMS notifications yet.'}
          </p>
        ) : null}
        {items.map((item) => {
          const name = displayName(item)
          return (
            <article key={item.id} className={`inbox-row${item.is_read ? '' : ' unread'}`}>
              <div className="inbox-to">
                <span className="inbox-avatar">{initials(name)}</span>
                <strong>{name}</strong>
              </div>
              <p className="inbox-message">{preview(item.body)}</p>
              <span className={`inbox-status ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
              <time className="inbox-time">{formatSendTime(item.created_at)}</time>
              <div className="inbox-actions">
                <button type="button" className="inbox-btn" title="View" onClick={() => setSelected(item)}>
                  <IconEye />
                </button>
                <button
                  type="button"
                  className="inbox-btn danger"
                  title="Delete"
                  disabled={!canDelete || busy === `del-${item.id}`}
                  onClick={() => removeOne(item)}
                >
                  <IconTrash />
                </button>
                <button
                  type="button"
                  className="inbox-btn"
                  title="Mark as read"
                  disabled={item.is_read || busy === `read-${item.id}`}
                  onClick={() => markRead(item)}
                >
                  <IconMail />
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {items.length > 0 ? (
        <div className="pager">
          <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button type="button" className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      ) : null}
      {selected ? (
        <div className="inbox-modal" role="dialog" aria-modal="true">
          <div className="inbox-modal-card">
            <header>
              <div>
                <h2>{selected.title || 'Order SMS'}</h2>
                <p className="muted">
                  To {selected.recipients || 'n/a'} · From {selected.sender || 'n/a'}
                </p>
              </div>
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </header>
            <pre className="notice-body">{selected.body}</pre>
            <div className="inbox-modal-actions">
              <button className="btn" type="button" onClick={() => markRead(selected)} disabled={selected.is_read}>
                {selected.is_read ? 'Read' : 'Mark as read'}
              </button>
              {canDelete ? (
                <button className="btn ghost" type="button" onClick={() => removeOne(selected)}>
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
