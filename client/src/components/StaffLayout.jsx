import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { IconBag, IconBoxes, IconChevron, IconCog, IconGrid, IconLogout, IconShield, IconShirt, IconUsers } from './Icons.jsx'
import Logo from './Logo.jsx'
import { request } from '../api.js'
import { PRIV, can } from '../privileges.js'

const SIDEBAR_KEY = 'af-trends-sidebar-collapsed'

function initials(name) {
  return (name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function NavItem({ to, end, icon, label, badge }) {
  const count = Number(badge) || 0
  const title = count ? `${label} · ${count} pending` : label
  return (
    <NavLink to={to} end={end} title={title}>
      <span className="side-icon-wrap">
        {icon}
        {count ? (
          <span className="side-badge" aria-label={`${count} pending orders`}>
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </span>
      <span className="side-label">{label}</span>
    </NavLink>
  )
}

export default function StaffLayout({ session, onLogout }) {
  const role = session?.user?.role
  const location = useLocation()
  const canCatalog = can(session?.user, PRIV.CATALOG_READ)
  const canUsers = can(session?.user, PRIV.USERS_MANAGE)
  const canSettings = can(session?.user, PRIV.SETTINGS_MANAGE)
  const [pendingCount, setPendingCount] = useState(0)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    if (!session?.token) return
    request('/staff/orders?status=pending&page_size=1', { token: session.token })
      .then((data) => setPendingCount(Number(data.total) || 0))
      .catch(() => setPendingCount(0))
  }, [session?.token, location.pathname])

  return (
    <div className={collapsed ? 'staff collapsed' : 'staff'}>
      <aside className="side">
        <div className="side-top">
          <Link className="side-brand" to="/" title="AF Trends store">
            <Logo />
          </Link>
          <button
            type="button"
            className="side-toggle"
            onClick={() => setCollapsed((open) => !open)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <IconChevron />
          </button>
        </div>
        <nav className="side-nav" aria-label="Staff">
          <NavItem to="/staff" end icon={<IconGrid />} label="Dashboard" />
          <NavItem to="/staff/orders" icon={<IconBag />} label="Orders" badge={pendingCount} />
          {canCatalog ? <NavItem to="/staff/products" icon={<IconShirt />} label="Shirts" /> : null}
          {canCatalog ? <NavItem to="/staff/stock" icon={<IconBoxes />} label="Stock" /> : null}
          {canUsers ? <NavItem to="/staff/users" icon={<IconUsers />} label="Users" /> : null}
          <NavItem to="/staff/control" icon={<IconShield />} label="Control Center" />
        </nav>
        <div className="side-foot">
          {canSettings ? <NavItem to="/staff/settings" icon={<IconCog />} label="Settings" /> : null}
          <button type="button" className="side-logout" onClick={onLogout} title="Sign out">
            <IconLogout />
            <span className="side-label">Sign out</span>
          </button>
          <div className="side-user">
            <span className="side-avatar">{initials(session.user.full_name)}</span>
            <span className="side-user-meta">
              <strong>{session.user.full_name}</strong>
              <span>{role}</span>
            </span>
          </div>
        </div>
      </aside>
      <div className="staff-main">
        <Outlet />
      </div>
    </div>
  )
}
