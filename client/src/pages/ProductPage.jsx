import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { money, request } from '../api.js'

export default function ProductPage({ session }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [colorId, setColorId] = useState('')
  const [size, setSize] = useState('')
  const [imageId, setImageId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request(`/catalog/products/${slug}`)
      .then((data) => {
        setProduct(data)
        const firstColor = data.colors[0]?.id || ''
        setColorId(firstColor)
        setSize(data.sizes[0] || '')
        const firstImage = data.images[0]?.id || ''
        setImageId(firstImage)
      })
      .catch((err) => setError(err.message))
  }, [slug])

  const images = useMemo(() => {
    if (!product) return []
    const tagged = product.images.filter((img) => img.color_id === colorId)
    const untagged = product.images.filter((img) => !img.color_id)
    return tagged.length ? [...tagged, ...untagged] : product.images
  }, [product, colorId])

  const variant = product?.variants.find((row) => row.color.id === colorId && row.size === size)
  const activeImage = images.find((img) => img.id === imageId) || images[0]

  useEffect(() => {
    if (images[0]) setImageId(images[0].id)
  }, [colorId, product])

  async function addToCart() {
    if (session?.user?.role && session.user.role !== 'client') {
      setError('Staff accounts cannot place customer orders. Sign in as a client.')
      return
    }
    if (!variant) {
      setError('Choose a color and size.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await request('/cart/items', {
        method: 'POST',
        token: session?.user?.role === 'client' ? session.token : undefined,
        body: { variant_id: variant.id, quantity: 1 },
      })
      navigate('/cart')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !product) {
    return <p className="error wrap">{error}</p>
  }
  if (!product) return <p className="wrap muted">Loading…</p>

  return (
    <main className="product wrap">
      <div className="gallery">
        <div className="main">
          {activeImage ? <img src={activeImage.url} alt={activeImage.alt_text || product.name} /> : null}
        </div>
        <div className="thumbs">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className={image.id === activeImage?.id ? 'active' : ''}
              onClick={() => setImageId(image.id)}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="eyebrow">T-shirt</p>
        <h1>{product.name}</h1>
        {variant && Number(variant.stock) <= 0 ? <span className="stock-label out_of_stock">Out of stock</span> : null}
        <p className="price">{money(variant?.price || product.base_price, product.currency)}</p>
        <p className="lead">{product.description}</p>
        <div className="picker">
          <p>Color · {product.colors.find((c) => c.id === colorId)?.name}</p>
          <div className="swatches">
            {product.colors.map((color) => (
              <button
                key={color.id}
                type="button"
                className={`swatch ${color.id === colorId ? 'selected' : ''}`}
                style={{ background: color.hex }}
                aria-label={color.name}
                onClick={() => setColorId(color.id)}
              />
            ))}
          </div>
        </div>
        <div className="picker">
          <p>Size {variant ? `· ${variant.stock} left` : ''}</p>
          <div className="sizes">
            {product.sizes.map((value) => {
              const match = product.variants.find((row) => row.color.id === colorId && row.size === value)
              return (
                <button
                  key={value}
                  type="button"
                  className={value === size ? 'active' : ''}
                  disabled={!match || match.stock <= 0}
                  onClick={() => setSize(value)}
                >
                  {value}
                </button>
              )
            })}
          </div>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button type="button" className="btn" onClick={addToCart} disabled={busy || !variant || Number(variant.stock) <= 0}>
          {Number(variant?.stock) <= 0 ? 'Out of stock' : 'Add to cart'}
        </button>
        <p className="muted" style={{ marginTop: 12 }}>
          Payment is collected before we deliver nationwide.
        </p>
      </div>
    </main>
  )
}
