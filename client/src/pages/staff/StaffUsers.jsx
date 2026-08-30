import { useEffect, useMemo, useState } from 'react'
import { request } from '../../api.js'
import UserFormModal from '../../components/UserFormModal.jsx'
import { IconUsers } from '../../components/Icons.jsx'

const TABS = [
  { id: 'staff', label: 'Staff' },
  { id: 'users', label: 'Users' },
]

const ROLE_LABELS = {
  superadmin: 'Superadmin',
  manager: 'Manager',
  support: 'Support',
  client: 'Customer',
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

function isStaffRole(role) {
  return role !== 'client'
}

export default function StaffUsers({ session }) {
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('staff')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    request('/staff/users?page_size=100', { token: session.token })
      .then((data) => setUsers(data.items || []))
      .catch((err) => setError(err.message))
  }

  useEffect(load, [session.token])

  const counts = useMemo(
    () => ({
      staff: users.filter((user) => isStaffRole(user.role)).length,
      users: users.filter((user) => user.role === 'client').length,
    }),
    [users],
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return users.filter((user) => {
      if (tab === 'staff' ? !isStaffRole(user.role) : user.role !== 'client') return false
      if (!term) return true
      return `${user.full_name} ${user.email} ${user.phone} ${user.role}`.toLowerCase().includes(term)
    })
  }, [users, tab, query])

  async function create(form) {
    setBusy(true)
    setModalError('')
    try {
      await request('/staff/users', {
        method: 'POST',
        token: session.token,
        body: {
          ...form,
          role: tab === 'staff' ? form.role : 'client',
        },
      })
      setAdding(false)
      load()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(user) {
    if (user.id === session.user.id) {
      setError('You cannot deactivate your own account.')
      return
    }
    setError('')
    try {
      await request(`/staff/users/${user.id}`, {
        method: 'PATCH',
        token: session.token,
        body: { is_active: !user.is_active },
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const createLabel = tab === 'staff' ? 'New staff' : 'New user'

  return (
    <div className="dash users-page">
      <header className="dash-head">
        <div>
          <h1>People</h1>
          <p>Staff run the console. Users are customers on the store.</p>
        </div>
        <div className="dash-tools">
          <label className="dash-search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'staff' ? 'Search staff' : 'Search users'}
              aria-label="Search people"
            />
          </label>
          <button type="button" className="btn" onClick={() => { setModalError(''); setAdding(true) }}>
            {createLabel}
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="status-tabs" role="tablist" aria-label="People">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id && !adding}
            className={tab === item.id && !adding ? 'active' : ''}
            onClick={() => {
              setTab(item.id)
              setAdding(false)
              setQuery('')
            }}
          >
            {item.label}
            <span className="count">{counts[item.id]}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={adding}
          className={adding ? 'active' : ''}
          onClick={() => { setModalError(''); setAdding(true) }}
        >
          {createLabel}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="shirts-empty">
          <IconUsers />
          <h2>{users.length === 0 ? 'No accounts yet' : `No ${tab === 'staff' ? 'staff' : 'users'} in this view`}</h2>
          <p className="muted">
            {query
              ? 'Try a different search.'
              : tab === 'staff'
                ? 'Add a manager or support account for the console.'
                : 'Add a customer account, or they can register on the store.'}
          </p>
          <button type="button" className="btn" onClick={() => { setModalError(''); setAdding(true) }}>
            {createLabel}
          </button>
        </div>
      ) : (
        <div className="dash-card table-card">
          <div className="table-wrap">
            <table className="table stock-table">
              <thead>
                <tr>
                  <th>{tab === 'staff' ? 'Staff' : 'User'}</th>
                  <th>Contact</th>
                  {tab === 'staff' ? <th>Role</th> : null}
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person-name">
                        <span className="person-avatar" aria-hidden="true">
                          {initials(user.full_name)}
                        </span>
                        <div>
                          <strong>{user.full_name}</strong>
                          {user.id === session.user.id ? <div className="muted">You</div> : null}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{user.email}</div>
                      {user.phone ? <div className="muted">{user.phone}</div> : null}
                    </td>
                    {tab === 'staff' ? (
                      <td>
                        <span className={`role-chip ${user.role}`}>{ROLE_LABELS[user.role] || user.role}</span>
                      </td>
                    ) : null}
                    <td>
                      <span className={`status-pill ${user.is_active ? 'live' : 'draft'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={user.id === session.user.id}
                        onClick={() => toggle(user)}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adding ? (
        <UserFormModal
          mode={tab === 'staff' ? 'staff' : 'users'}
          busy={busy}
          error={modalError}
          onClose={() => setAdding(false)}
          onSubmit={create}
        />
      ) : null}
    </div>
  )
}
