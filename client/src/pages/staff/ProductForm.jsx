import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { request } from '../../api.js'
import ShirtEditorFields, { emptyShirtForm, buildVariants } from '../../components/ShirtEditorFields.jsx'

export default function ProductForm({ session }) {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const [palette, setPalette] = useState([])
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(() => emptyShirtForm())
  const [published, setPublished] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request('/staff/palette/colors', { token: session.token }).then((data) => {
      const colors = data.items || []
      setPalette(colors)
      if (isNew) setForm((current) => (current.colorIds.length ? current : emptyShirtForm(colors)))
    })
  }, [session.token, isNew])

  useEffect(() => {
    if (isNew) return
    request(`/staff/products/${id}`, { token: session.token })
      .then((data) => {
        setProduct(data)
        const qty = {}
        data.variants.forEach((variant) => {
          qty[`${variant.color.id}:${variant.size}`] = String(variant.stock)
        })
        setForm({
          name: data.name,
          description: data.description,
          cost_price: data.cost_price || '0.00',
          selling_price: data.base_price,
          colorIds: data.colors.map((color) => color.id),
          sizes: data.sizes,
          qty,
        })
        setPublished(data.is_published)
      })
      .catch((err) => setError(err.message))
  }, [id, isNew, session.token])

  const colorMap = useMemo(() => Object.fromEntries(palette.map((color) => [color.id, color])), [palette])

  async function saveBasics(event) {
    event.preventDefault()
    if (!form.colorIds.length || !form.sizes.length) {
      setError('Pick at least one color and one size.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const body = {
        name: form.name,
        description: form.description,
        base_price: form.selling_price,
        cost_price: form.cost_price,
        color_ids: form.colorIds,
        sizes: form.sizes,
        is_published: isNew ? false : published,
      }
      if (isNew) body.variants = buildVariants(form)
      const saved = isNew
        ? await request('/staff/products', { method: 'POST', token: session.token, body })
        : await request(`/staff/products/${id}`, { method: 'PATCH', token: session.token, body })
      if (isNew) {
        navigate(`/staff/products/${saved.id}`)
        return
      }
      setProduct(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveStock(event) {
    event.preventDefault()
    if (!product) return
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      stock: Number(form.qty[`${variant.color.id}:${variant.size}`] ?? variant.stock),
    }))
    try {
      const saved = await request(`/staff/products/${product.id}/variants`, {
        method: 'PUT',
        token: session.token,
        body: { variants },
      })
      setProduct(saved)
    } catch (err) {
      setError(err.message)
    }
  }

  async function upload(event) {
    const files = event.target.files
    if (!files?.length || !product) return
    const payload = new FormData()
    Array.from(files).forEach((file) => payload.append('files', file))
    try {
      const saved = await request(`/staff/products/${product.id}/images`, {
        method: 'POST',
        token: session.token,
        form: payload,
      })
      setProduct(saved)
      event.target.value = ''
    } catch (err) {
      setError(err.message)
    }
  }

  async function tagImage(image, colorId) {
    const saved = await request(`/staff/products/${product.id}/images/${image.id}`, {
      method: 'PATCH',
      token: session.token,
      body: { color_id: colorId || null, is_primary: image.is_primary },
    })
    setProduct(saved)
  }

  async function makePrimary(image) {
    const saved = await request(`/staff/products/${product.id}/images/${image.id}`, {
      method: 'PATCH',
      token: session.token,
      body: { is_primary: true },
    })
    setProduct(saved)
  }

  async function removeImage(image) {
    const saved = await request(`/staff/products/${product.id}/images/${image.id}`, {
      method: 'DELETE',
      token: session.token,
    })
    setProduct(saved)
  }

  return (
    <div className="dash product-edit">
      <header className="dash-head">
        <div>
          <p className="edit-back">
            <Link to="/staff/products">All shirts</Link>
            {product ? (
              <>
                {' · '}
                <Link to="/staff/stock">Stock</Link>
              </>
            ) : null}
          </p>
          <h1>{isNew ? 'New shirt' : form.name || 'Edit shirt'}</h1>
          <p>{isNew ? 'Create a draft, then add photos before publishing.' : 'Update details, stock, and photos.'}</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <form className="edit-card" onSubmit={saveBasics}>
        <ShirtEditorFields
          form={form}
          onChange={setForm}
          palette={palette}
          showQty={isNew}
          session={session}
          onPaletteChange={setPalette}
        />
        {!isNew ? (
          <label className="publish-toggle">
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
            Published on the store
          </label>
        ) : (
          <p className="muted">Save first, then add images, then publish.</p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : isNew ? 'Create shirt' : 'Save details'}
        </button>
      </form>

      {product ? (
        <>
          <form className="edit-card" onSubmit={saveStock}>
            <p className="form-kicker">Stock on hand</p>
            <p className="muted qty-hint">Adjust units after a delivery or a count.</p>
            <div className="qty-board">
              {form.colorIds.map((colorId) => (
                <div className="qty-group" key={colorId}>
                  <div className="qty-group-head">
                    <span className="swatch" style={{ background: colorMap[colorId]?.hex || '#ccc' }} />
                    <strong>{colorMap[colorId]?.name || 'Color'}</strong>
                  </div>
                  <div className="qty-sizes">
                    {form.sizes.map((size) => (
                      <label className="qty-cell" key={size}>
                        <span>{size}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={form.qty[`${colorId}:${size}`] ?? '0'}
                          onChange={(event) =>
                            setForm({ ...form, qty: { ...form.qty, [`${colorId}:${size}`]: event.target.value } })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn ghost" type="submit">
              Save stock
            </button>
          </form>

          <section className="edit-card">
            <p className="form-kicker">Photos</p>
            <p className="muted qty-hint">JPEG, PNG or WebP. Tag a photo to a color so the gallery follows the swatch.</p>
            <label className="upload-btn">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} />
              Add photos
            </label>
            <div className="image-grid">
              {product.images.map((image) => (
                <article className="image-card" key={image.id}>
                  <img src={image.url} alt={image.alt_text} />
                  <div className="image-card-body">
                    <select value={image.color_id || ''} onChange={(event) => tagImage(image, event.target.value)}>
                      <option value="">All colors</option>
                      {product.colors.map((color) => (
                        <option key={color.id} value={color.id}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                    {image.is_primary ? <span className="badge">Primary</span> : null}
                    <div className="row-actions">
                      {!image.is_primary ? (
                        <button type="button" className="btn ghost" onClick={() => makePrimary(image)}>
                          Primary
                        </button>
                      ) : null}
                      <button type="button" className="btn ghost" onClick={() => removeImage(image)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
