import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import { isStaff, request } from '../api.js'
import { IconBag, IconHeart, IconSearch, IconUser } from './Icons.jsx'
import Logo from './Logo.jsx'

export default function StoreLayout({ session, onLogout }) {
  const user = session?.user
  const navigate = useNavigate()
  const [cartCount, setCartCount] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (user?.role !== 'client') {
      setCartCount(0)
      return
    }
    request('/cart', { token: session.token })
      .then((cart) => setCartCount((cart.items || []).reduce((sum, item) => sum + item.quantity, 0)))
      .catch(() => setCartCount(0))
  }, [session, user?.role])

  function submitSearch(event) {
    event.preventDefault()
    const next = query.trim()
    setSearchOpen(false)
    navigate(next ? `/?q=${encodeURIComponent(next)}#shop` : '/#shop')
  }

  return (
    <div className="store">
      <div className="announce">
        <span>Pay on delivery nationwide</span>
        <span>Custom design tees</span>
        <span>Ships Accra, Kumasi, and beyond</span>
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
            <Link className="icon-btn bag" to={user?.role === 'client' ? '/cart' : '/login'} aria-label="Cart">
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
            <span>Zones from Accra Metro out.</span>
          </div>
          <div>
            <strong>Pay on delivery</strong>
            <span>Cash when the shirt arrives.</span>
          </div>
          <div>
            <strong>Color &amp; size</strong>
            <span>The same options at upload and checkout.</span>
          </div>
          <div>
            <strong>Staff support</strong>
            <span>Every COD drop is tracked.</span>
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
