import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, request } from '../api.js'
import {
  IconArrow,
  IconBag,
  IconChevron,
  IconHeadset,
  IconHeart,
  IconLock,
  IconReturn,
  IconStar,
  IconTruck,
} from '../components/Icons.jsx'

function Stars() {
  return (
    <span className="stars" aria-label="5 stars">
      <IconStar />
      <IconStar />
      <IconStar />
      <IconStar />
      <IconStar />
      <span>(128)</span>
    </span>
  )
}

function useCountdown() {
  const target = useMemo(() => Date.now() + 1000 * 60 * 60 * 36, [])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, target - now)
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function LandingPage() {
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const scroller = useRef(null)
  const countdown = useCountdown()

  useEffect(() => {
    setError('')
    request('/catalog/products?page_size=48&sort=newest')
      .then((data) => setProducts(data.items || []))
      .catch((err) => setError(err.message))
  }, [])

  const floaters = products.slice(0, 3)
  const featured = products.slice(0, 6)
  const arrivals = products
  const bestsellers = products.slice(0, 3)

  function scrollRow(dir) {
    scroller.current?.scrollBy({ left: dir * 280, behavior: 'smooth' })
  }

  return (
    <main className="home">
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="chip">Trending now</p>
          <h1>Discover tees you’ll love.</h1>
          <p className="lede">
            Custom African-inspired prints on heavy cotton. Pick a color, pick a
            size, pay when it arrives.
          </p>
          <div className="hero-actions">
            <a className="btn" href="#shop">
              Shop now <IconArrow />
            </a>
            <a className="btn ghost" href="#arrivals">
              Explore collection
            </a>
          </div>
          <div className="social-proof">
            <div className="avatars">
              <img src="/photos/hero.jpg" alt="" />
              <img src="/photos/collection.jpg" alt="" />
              <img src="/photos/line.jpg" alt="" />
            </div>
            <p>Loved by customers across Accra, Kumasi, and beyond.</p>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-blob" />
          <img className="hero-photo" src="/photos/hero.jpg" alt="AF Trends lookbook" />
          {floaters.map((product, index) => (
            <Link className={`floater f${index + 1}`} key={product.id} to={`/shirts/${product.slug}`}>
              {product.primary_image ? <img src={product.primary_image.url} alt="" /> : null}
              <div>
                <strong>{product.name}</strong>
                <span>{money(product.base_price, product.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="trust wrap">
        <div>
          <IconTruck />
          <div>
            <strong>Nationwide delivery</strong>
            <span>Accra Metro and other regions</span>
          </div>
        </div>
        <div>
          <IconLock />
          <div>
            <strong>Pay on delivery</strong>
            <span>Cash when the shirt arrives</span>
          </div>
        </div>
        <div>
          <IconReturn />
          <div>
            <strong>Color &amp; size</strong>
            <span>Same options at upload and checkout</span>
          </div>
        </div>
        <div>
          <IconHeadset />
          <div>
            <strong>24/7 support</strong>
            <span>Staff track every drop-off</span>
          </div>
        </div>
      </section>

      <section className="section wrap" id="categories">
        <div className="section-head">
          <h2>Shop by categories</h2>
          <a href="#shop">
            View all categories <IconArrow />
          </a>
        </div>
        <div className="cat-grid">
          {featured.map((product) => (
            <Link className="cat-card" key={product.id} to={`/shirts/${product.slug}`}>
              <div className="photo">
                {product.primary_image ? <img src={product.primary_image.url} alt={product.name} /> : null}
              </div>
              <div className="cat-label">
                <strong>{product.name.replace(' Tee', '')}</strong>
                <span>
                  Shop now <IconChevron />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section wrap" id="arrivals">
        <div className="section-head">
          <h2>New arrivals</h2>
          <div className="row-nav">
            <a href="#shop">View all new arrivals</a>
            <button type="button" className="icon-btn" onClick={() => scrollRow(-1)} aria-label="Previous">
              <IconChevron style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button type="button" className="icon-btn" onClick={() => scrollRow(1)} aria-label="Next">
              <IconChevron />
            </button>
          </div>
        </div>
        <div className="arrival-row" ref={scroller}>
          {arrivals.map((product, index) => (
            <article className="product-card" key={product.id}>
              <Link to={`/shirts/${product.slug}`} className="photo">
                <span className={`tag ${index === 1 ? 'sale' : ''}`}>{index === 1 ? '-20%' : 'New'}</span>
                <span className="wish" aria-hidden="true">
                  <IconHeart />
                </span>
                {product.primary_image ? <img src={product.primary_image.url} alt={product.name} /> : null}
              </Link>
              <div className="meta">
                <h3>
                  <Link to={`/shirts/${product.slug}`}>{product.name}</Link>
                </h3>
                <div className="price-row">
                  <span>
                    {money(product.base_price, product.currency)}
                    {index === 1 ? (
                      <s>{money((Number(product.base_price) * 1.25).toFixed(2), product.currency)}</s>
                    ) : null}
                  </span>
                  <Stars />
                </div>
                <Link className="add-round" to={`/shirts/${product.slug}`} aria-label={`Shop ${product.name}`}>
                  <IconBag />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section wrap" id="bestsellers">
        <div className="section-head">
          <h2>Best sellers</h2>
          <a href="#shop">View all best sellers</a>
        </div>
        <div className="best-grid">
          {bestsellers.map((product) => (
            <article className="best-card" key={product.id}>
              <Link className="photo" to={`/shirts/${product.slug}`}>
                {product.primary_image ? <img src={product.primary_image.url} alt={product.name} /> : null}
              </Link>
              <div>
                <span className="tag sale relative">Bestseller</span>
                <h3>
                  <Link to={`/shirts/${product.slug}`}>{product.name}</Link>
                </h3>
                <p className="price">{money(product.base_price, product.currency)}</p>
                <Stars />
                <p className="muted">
                  Heavy cotton, custom print. Choose a color at checkout and pay on delivery.
                </p>
                <div className="best-actions">
                  <Link className="btn dark" to={`/shirts/${product.slug}`}>
                    Quick add
                  </Link>
                  <Link className="add-round static" to={`/shirts/${product.slug}`} aria-label={`Add ${product.name}`}>
                    <IconBag />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="promo wrap" id="deals">
        <div className="promo-card sale">
          <div>
            <p className="chip light">Flash sale</p>
            <h3>Pay on delivery. Up to ready-to-wear drops.</h3>
            <div className="timer">
              <div>
                <b>{pad(countdown.days)}</b>
                <span>Days</span>
              </div>
              <div>
                <b>{pad(countdown.hours)}</b>
                <span>Hours</span>
              </div>
              <div>
                <b>{pad(countdown.mins)}</b>
                <span>Mins</span>
              </div>
              <div>
                <b>{pad(countdown.secs)}</b>
                <span>Secs</span>
              </div>
            </div>
            <a className="btn light" href="#shop">
              Shop sale now
            </a>
          </div>
          <img src="/photos/line.jpg" alt="" />
        </div>
        <div className="promo-card collection">
          <div>
            <p className="chip light">New collection</p>
            <h3>Custom prints for 2026.</h3>
            <p>Lookbook shots from the line — hangers, street wear, and studio tees.</p>
            <a className="btn ghost light" href="#arrivals">
              Shop collection
            </a>
          </div>
          <img src="/photos/collection.jpg" alt="" />
        </div>
      </section>

      <section className="section wrap" id="shop">
        <div className="section-head">
          <h2>All tees</h2>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="grid">
          {products.map((product) => (
            <Link className="product-card shop-card" key={product.id} to={`/shirts/${product.slug}`}>
              <div className="photo">
                {product.primary_image ? <img src={product.primary_image.url} alt={product.name} /> : null}
              </div>
              <div className="meta">
                <h3>{product.name}</h3>
                <div className="price">{money(product.base_price, product.currency)}</div>
                <div className="swatches">
                  {product.colors.map((color) => (
                    <span key={color.id} className="swatch" style={{ background: color.hex }} title={color.name} />
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
