import { useEffect, useState } from 'react'

function emptyForm(role) {
  return {
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: role === 'staff' ? 'manager' : 'client',
  }
}

export default function UserFormModal({ mode = 'staff', busy, error, onClose, onSubmit }) {
  const [form, setForm] = useState(() => emptyForm(mode))

  useEffect(() => {
    setForm(emptyForm(mode))
  }, [mode])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, busy])

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const isStaff = mode === 'staff'
  const title = isStaff ? 'New staff' : 'New customer'
  const hint = isStaff
    ? 'Managers run catalog and stock. Support handles orders.'
    : 'A customer account can shop and pay before delivery.'

  return (
    <div className="modal-back sheet" onClick={() => !busy && onClose()} role="presentation">
      <form
        className="modal-card form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(form)
        }}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">{isStaff ? 'Team' : 'Store'}</p>
            <h2 id="user-modal-title">{title}</h2>
            <p className="muted modal-meta">{hint}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}>
            ×
          </button>
        </header>

        {error ? <p className="error form-error">{error}</p> : null}

        <div className="form-scroll">
          <div className="shirt-form">
            <section className="form-block">
              <p className="form-kicker">1. Profile</p>
              <label htmlFor="user-name">Full name</label>
              <input
                id="user-name"
                value={form.full_name}
                onChange={(event) => patch('full_name', event.target.value)}
                placeholder="Ama Mensah"
                autoComplete="name"
                required
              />
              <label htmlFor="user-email">Email</label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(event) => patch('email', event.target.value)}
                placeholder="ama@aftrends.com"
                autoComplete="email"
                required
              />
              <label htmlFor="user-phone">Phone</label>
              <input
                id="user-phone"
                value={form.phone}
                onChange={(event) => patch('phone', event.target.value)}
                placeholder="024 000 0000"
                autoComplete="tel"
              />
            </section>
            <section className="form-block">
              <p className="form-kicker">2. Access</p>
              <label htmlFor="user-password">Password</label>
              <input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(event) => patch('password', event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
              {isStaff ? (
                <>
                  <p className="field-label">Role</p>
                  <div className="choice-row" role="group" aria-label="Staff role">
                    {[
                      { id: 'manager', label: 'Manager' },
                      { id: 'support', label: 'Support' },
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        className={`choice-chip${form.role === role.id ? ' on' : ''}`}
                        aria-pressed={form.role === role.id}
                        onClick={() => patch('role', role.id)}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted qty-hint">This account signs in as a customer on the store.</p>
              )}
            </section>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : isStaff ? 'Create staff' : 'Create customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
