export const PRIV = {
  STAFF_LOGIN: 'staff.login',
  ORDERS_READ: 'orders.read',
  ORDERS_UPDATE: 'orders.update',
  ORDERS_COLLECT: 'orders.collect',
  ORDERS_DELETE: 'orders.delete',
  CATALOG_READ: 'catalog.read',
  CATALOG_WRITE: 'catalog.write',
  CATALOG_DELETE: 'catalog.delete',
  PALETTE_WRITE: 'palette.write',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage',
}

export const STAFF_ROLES = ['support', 'manager', 'superadmin']

export const PRIVILEGE_CATALOG = [
  { id: PRIV.STAFF_LOGIN, label: 'Sign in to staff console', group: 'Login' },
  { id: PRIV.ORDERS_READ, label: 'View orders', group: 'Orders' },
  { id: PRIV.ORDERS_UPDATE, label: 'Update order status', group: 'Orders' },
  { id: PRIV.ORDERS_COLLECT, label: 'Collect cash on delivery', group: 'Orders' },
  { id: PRIV.ORDERS_DELETE, label: 'Delete closed orders', group: 'Orders' },
  { id: PRIV.CATALOG_READ, label: 'View shirts and stock', group: 'Catalog' },
  { id: PRIV.CATALOG_WRITE, label: 'Create and edit shirts', group: 'Catalog' },
  { id: PRIV.CATALOG_DELETE, label: 'Delete shirts', group: 'Catalog' },
  { id: PRIV.PALETTE_WRITE, label: 'Add palette colors', group: 'Catalog' },
  { id: PRIV.USERS_MANAGE, label: 'Manage people', group: 'Admin' },
  { id: PRIV.SETTINGS_MANAGE, label: 'Change store settings', group: 'Admin' },
]

const SUPPORT = [PRIV.STAFF_LOGIN, PRIV.ORDERS_READ, PRIV.ORDERS_UPDATE, PRIV.CATALOG_READ]

const MANAGER = [
  ...SUPPORT,
  PRIV.ORDERS_COLLECT,
  PRIV.ORDERS_DELETE,
  PRIV.CATALOG_WRITE,
  PRIV.CATALOG_DELETE,
  PRIV.PALETTE_WRITE,
]

const SUPERADMIN = Object.values(PRIV)

const MATRIX = {
  support: SUPPORT,
  manager: MANAGER,
  superadmin: SUPERADMIN,
}

export function privilegesFor(role) {
  return MATRIX[role] || []
}

export function can(roleOrUser, priv) {
  if (!roleOrUser || !priv) return false
  if (typeof roleOrUser === 'object') {
    const listed = roleOrUser.privileges
    if (Array.isArray(listed) && listed.length) return listed.includes(priv)
    return privilegesFor(roleOrUser.role).includes(priv)
  }
  return privilegesFor(roleOrUser).includes(priv)
}
