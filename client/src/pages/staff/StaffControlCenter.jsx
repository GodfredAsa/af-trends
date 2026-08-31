import PrivilegeMatrix from '../../components/PrivilegeMatrix.jsx'
import { PRIV, can } from '../../privileges.js'

export default function StaffControlCenter({ session, onUser }) {
  const canEdit = can(session.user, PRIV.SETTINGS_MANAGE)

  return (
    <div className="dash control-center">
      <header className="dash-head">
        <div>
          <h1>Control Center</h1>
          <p>
            {canEdit
              ? 'Turn privileges on or off for support and managers, including staff login. Superadmin stays fully on.'
              : 'Your team’s privilege matrix. Only a superadmin can change these switches.'}
          </p>
        </div>
      </header>
      <PrivilegeMatrix session={session} onUser={onUser} />
    </div>
  )
}
