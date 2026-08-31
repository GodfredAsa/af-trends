import { useEffect, useMemo, useState } from 'react'
import { request } from '../api.js'
import { IconShield } from './Icons.jsx'
import { PRIV, PRIVILEGE_CATALOG, STAFF_ROLES, can, privilegesFor } from '../privileges.js'

const VIEW_TABS = [
  { id: 'all', label: 'All' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
]

const ROLE_LABELS = {
  support: 'Support',
  manager: 'Manager',
  superadmin: 'Superadmin',
}

function emptyMatrix() {
  const flags = {}
  STAFF_ROLES.forEach((role) => {
    const granted = privilegesFor(role)
    flags[role] = Object.fromEntries(PRIVILEGE_CATALOG.map((item) => [item.id, granted.includes(item.id)]))
  })
  return flags
}

function defaultLocked() {
  return {
    support: [PRIV.USERS_MANAGE, PRIV.SETTINGS_MANAGE],
    manager: [PRIV.USERS_MANAGE, PRIV.SETTINGS_MANAGE],
    superadmin: PRIVILEGE_CATALOG.map((item) => item.id),
  }
}

export default function PrivilegeMatrix({ session, onUser }) {
  const [roles, setRoles] = useState(STAFF_ROLES)
  const [privileges, setPrivileges] = useState(PRIVILEGE_CATALOG)
  const [matrix, setMatrix] = useState(emptyMatrix)
  const [locked, setLocked] = useState(defaultLocked)
  const [canEdit, setCanEdit] = useState(can(session.user, PRIV.SETTINGS_MANAGE))
  const [focus, setFocus] = useState(STAFF_ROLES.includes(session.user.role) ? session.user.role : 'support')
  const [view, setView] = useState('all')
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  function applyPayload(data) {
    setRoles(data.roles?.length ? data.roles : STAFF_ROLES)
    setPrivileges(data.privileges?.length ? data.privileges : PRIVILEGE_CATALOG)
    setMatrix(data.matrix || emptyMatrix())
    setLocked(data.locked || defaultLocked())
    setCanEdit(Boolean(data.can_edit))
  }

  useEffect(() => {
    request('/staff/privileges', { token: session.token })
      .then(applyPayload)
      .catch((err) => setError(err.message))
  }, [session.token])

  const groups = useMemo(() => {
    const seen = []
    privileges.forEach((item) => {
      if (!seen.includes(item.group)) seen.push(item.group)
    })
    return seen
  }, [privileges])

  const visible = useMemo(() => {
    const role = roles.includes(focus) ? focus : roles[0]
    return privileges.filter((item) => {
      const on = Boolean(matrix[role]?.[item.id])
      if (view === 'on') return on
      if (view === 'off') return !on
      return true
    })
  }, [privileges, matrix, roles, focus, view])

  function isLocked(role, priv) {
    return (locked[role] || []).includes(priv)
  }

  async function toggle(role, priv) {
    if (!canEdit || isLocked(role, priv) || busyKey) return
    const nextOn = !matrix[role]?.[priv]
    const next = {
      ...matrix,
      [role]: { ...matrix[role], [priv]: nextOn },
    }
    setMatrix(next)
    setBusyKey(`${role}:${priv}`)
    setError('')
    try {
      const saved = await request('/staff/privileges', {
        method: 'PATCH',
        token: session.token,
        body: { matrix: next },
      })
      applyPayload(saved)
      if (onUser) {
        const user = await request('/auth/me', { token: session.token })
        onUser(user)
      }
    } catch (err) {
      setError(err.message)
      request('/staff/privileges', { token: session.token })
        .then(applyPayload)
        .catch(() => {})
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="privilege-matrix">
      {error ? <p className="error">{error}</p> : null}

      <div className="control-toolbar">
        <div className="status-tabs" role="tablist" aria-label="Role to filter">
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={focus === role}
              className={focus === role ? 'active' : ''}
              onClick={() => setFocus(role)}
            >
              {ROLE_LABELS[role] || role}
            </button>
          ))}
        </div>
        <div className="status-tabs" role="tablist" aria-label="Show privileges">
          {VIEW_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-card table-card">
        <div className="table-wrap">
          <table className="table privilege-table">
            <thead>
              <tr>
                <th>Privilege</th>
                {roles.map((role) => (
                  <th key={role} className={focus === role ? 'focus-col' : ''}>
                    {ROLE_LABELS[role] || role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.flatMap((group) => {
                const rows = visible.filter((item) => item.group === group)
                if (!rows.length) return []
                return [
                  <tr className="priv-group" key={`g-${group}`}>
                    <th scope="colgroup">{group}</th>
                    {roles.map((role) => (
                      <th key={role} />
                    ))}
                  </tr>,
                  ...rows.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.label}</strong>
                        <span className="muted priv-id">{item.id}</span>
                      </td>
                      {roles.map((role) => {
                        const on = Boolean(matrix[role]?.[item.id])
                        const lockedCell = isLocked(role, item.id)
                        const disabled = !canEdit || lockedCell || Boolean(busyKey)
                        return (
                          <td key={role} className={focus === role ? 'focus-col' : ''}>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              aria-label={`${item.label} for ${role}`}
                              className={`priv-switch${on ? ' on' : ''}`}
                              disabled={disabled}
                              onClick={() => toggle(role, item.id)}
                            >
                              <span className="priv-knob" />
                              <span className="priv-state">{on ? 'On' : 'Off'}</span>
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 ? (
          <div className="shirts-empty">
            <IconShield />
            <h2>Nothing in this view</h2>
            <p className="muted">Switch to All, or pick another role.</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
