import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { isStaff, request } from '../api.js'
import { IconBag, IconHeart, IconSearch, IconUser } from './Icons.jsx'
import Logo from './Logo.jsx'

export default function StoreLayout({ session, onLogout }) {
  const user = session?.user
  const navigate = useNavigate()
  const location = useLocation()
  const [cartCount, setCartCount] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (isStaff(user?.role)) {
      setCartCount(0)
      return
    }
    request('/cart', { token: user?.role === 'client' ? session.token : undefined })
      .then((cart) => setCartCount((cart.items || []).reduce((sum, item) => sum + item.quantity, 0)))
      .catch(() => setCartCount(0))
  }, [session, user?.role, location.pathname])

  function submitSearch(event) {
    event.preventDefault()
    const next = query.trim()
    setSearchOpen(false)
    navigate(next ? `/?q=${encodeURIComponent(next)}#shop` : '/#shop')
  }

  return (
    <div className="store">
      <div className="announce">
        <span>Payment before delivery</span>
        <span>Custom design tees</span>
        <span>Nationwide delivery</span>
      </div>
      <header className="site-header">
        <div className="inner wrap">
          <Link className="brand" to="/">
            <Logo />
          </Link>
          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/" end>
              Home
            </NavLink>
            <a href="/#shop">Shop</a>
            <a href="/#arrivals">New Arrivals</a>
            <a href="/#bestsellers">Best Sellers</a>
            <a href="/#categories">Categories</a>
            {user?.role === 'client' ? <NavLink to="/account/orders">Orders</NavLink> : null}
            {isStaff(user?.role) ? <NavLink to="/staff">Staff</NavLink> : null}
          </nav>
          <div className="nav-tools">
            {searchOpen ? (
              <form className="nav-search" onSubmit={submitSearch}>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tees"
                  aria-label="Search tees"
                />
              </form>
            ) : (
              <button type="button" className="icon-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
                <IconSearch />
              </button>
            )}
            <Link className="icon-btn" to={user ? '/account/orders' : '/login'} aria-label="Saved">
              <IconHeart />
            </Link>
            <Link className="icon-btn" to={user ? (user.role === 'client' ? '/account/orders' : '/staff') : '/login'} aria-label="Account">
              <IconUser />
            </Link>
            <Link className="icon-btn bag" to={isStaff(user?.role) ? '/login' : '/cart'} aria-label="Cart">
              <IconBag />
              <span className="bag-count">{cartCount}</span>
            </Link>
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="site-footer">
        <div className="trust wrap foot-trust">
          <div>
            <strong>Nationwide delivery</strong>
            <span>We deliver across Ghana.</span>
          </div>
          <div>
            <strong>Payment before delivery</strong>
            <span>Pay first, then we ship your tee.</span>
          </div>
          <div>
            <strong>Color &amp; size</strong>
            <span>The same options at upload and checkout.</span>
          </div>
          <div>
            <strong>Staff support</strong>
            <span>Every order is tracked to your door.</span>
          </div>
        </div>
        <div className="inner wrap">
          <Link className="footer-logo" to="/">
            <Logo />
          </Link>
          {user ? (
            <button type="button" className="link" onClick={onLogout}>
              Sign out
            </button>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </div>
      </footer>
    </div>
  )
}
