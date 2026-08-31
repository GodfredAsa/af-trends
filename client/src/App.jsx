import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { isStaff, readSession, request, writeSession } from './api.js'
import { PRIV, can } from './privileges.js'
import StoreLayout from './components/StoreLayout.jsx'
import StaffLayout from './components/StaffLayout.jsx'
import LandingPage from './pages/LandingPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import CartPage from './pages/CartPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import AddressesPage from './pages/AddressesPage.jsx'
import StaffDashboard from './pages/staff/Dashboard.jsx'
import StaffOrders from './pages/staff/StaffOrders.jsx'
import StaffOrderDetail from './pages/staff/StaffOrderDetail.jsx'
import StaffProducts from './pages/staff/StaffProducts.jsx'
import ProductForm from './pages/staff/ProductForm.jsx'
import StaffUsers from './pages/staff/StaffUsers.jsx'
import StaffSettings from './pages/staff/StaffSettings.jsx'
import StaffStock from './pages/staff/StaffStock.jsx'
import StaffControlCenter from './pages/staff/StaffControlCenter.jsx'

function ClientOnly({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  if (session.user.role !== 'client') return <Navigate to="/staff" replace />
  return children
}

function StaffOnly({ session, children, roles, priv }) {
  if (!session) return <Navigate to="/login" replace />
  if (!isStaff(session.user.role)) return <Navigate to="/" replace />
  if (priv && !can(session.user, priv)) return <Navigate to="/staff" replace />
  if (roles && !roles.includes(session.user.role)) return <Navigate to="/staff" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(readSession)

  useEffect(() => {
    const current = readSession()
    if (!current?.token) return
    request('/auth/me', { token: current.token })
      .then((user) => {
        const next = { ...current, user }
        writeSession(next)
        setSession(next)
      })
      .catch(() => {})
  }, [])

  function handleLogin(next) {
    writeSession(next)
    setSession(next)
  }

  function handleLogout() {
    writeSession(null)
    setSession(null)
  }

  function handleUser(user) {
    const current = readSession()
    if (!current?.token || !user) return
    const next = { ...current, user }
    writeSession(next)
    setSession(next)
  }

  return (
    <Routes>
      <Route element={<StoreLayout session={session} onLogout={handleLogout} />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/shirts/:slug" element={<ProductPage session={session} />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
        <Route
          path="/cart"
          element={
            <ClientOnly session={session}>
              <CartPage session={session} />
            </ClientOnly>
          }
        />
        <Route
          path="/checkout"
          element={
            <ClientOnly session={session}>
              <CheckoutPage session={session} />
            </ClientOnly>
          }
        />
        <Route
          path="/account/orders"
          element={
            <ClientOnly session={session}>
              <OrdersPage session={session} />
            </ClientOnly>
          }
        />
        <Route
          path="/account/orders/:id"
          element={
            <ClientOnly session={session}>
              <OrderDetailPage session={session} />
            </ClientOnly>
          }
        />
        <Route
          path="/account/addresses"
          element={
            <ClientOnly session={session}>
              <AddressesPage session={session} />
            </ClientOnly>
          }
        />
      </Route>
      <Route
        path="/staff"
        element={
          <StaffOnly session={session}>
            <StaffLayout session={session} onLogout={handleLogout} />
          </StaffOnly>
        }
      >
        <Route index element={<StaffDashboard session={session} />} />
        <Route path="orders" element={<StaffOrders session={session} />} />
        <Route path="orders/:id" element={<StaffOrderDetail session={session} />} />
        <Route
          path="products"
          element={
            <StaffOnly session={session} priv={PRIV.CATALOG_READ}>
              <StaffProducts session={session} />
            </StaffOnly>
          }
        />
        <Route
          path="products/:id"
          element={
            <StaffOnly session={session} priv={PRIV.CATALOG_READ}>
              <ProductForm session={session} />
            </StaffOnly>
          }
        />
        <Route
          path="stock"
          element={
            <StaffOnly session={session} priv={PRIV.CATALOG_READ}>
              <StaffStock session={session} />
            </StaffOnly>
          }
        />
        <Route
          path="users"
          element={
            <StaffOnly session={session} priv={PRIV.USERS_MANAGE}>
              <StaffUsers session={session} onUser={handleUser} />
            </StaffOnly>
          }
        />
        <Route
          path="control"
          element={<StaffControlCenter session={session} onUser={handleUser} />}
        />
        <Route
          path="settings"
          element={
            <StaffOnly session={session} priv={PRIV.SETTINGS_MANAGE}>
              <StaffSettings session={session} />
            </StaffOnly>
          }
        />
      </Route>
    </Routes>
  )
}
