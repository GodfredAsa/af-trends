import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { request } from '../../api.js'
import ShirtEditorFields, { emptyShirtForm, buildVariants } from '../../components/ShirtEditorFields.jsx'
import { PRIV, can } from '../../privileges.js'

export default function ProductForm({ session }) {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()
  const canWrite = can(session.user, PRIV.CATALOG_WRITE)
  const canDelete = can(session.user, PRIV.CATALOG_DELETE)
  const [palette, setPalette] = useState([])
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(() => emptyShirtForm())
  const [published, setPublished] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadColor, setUploadColor] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isNew && !canWrite) {
      navigate('/staff/products', { replace: true })
    }
  }, [isNew, canWrite, navigate])

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
          is_new_arrival: !!data.is_new_arrival,
        })
        setPublished(data.is_published)
        setUploadColor((current) => current || data.colors[0]?.id || '')
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
        is_new_arrival: !!form.is_new_arrival,
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
    if (!uploadColor) {
      setError('Select a color before adding photos.')
      event.target.value = ''
      return
    }
    const payload = new FormData()
    Array.from(files).forEach((file) => payload.append('files', file))
    payload.append('color_id', uploadColor)
    setUploading(true)
    setError('')
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
      event.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  async function tagImage(image, colorId) {
    if (!colorId) {
      setError('Each photo needs a color.')
      return
    }
    const saved = await request(`/staff/products/${product.id}/images/${image.id}`, {
      method: 'PATCH',
      token: session.token,
      body: { color_id: colorId, is_primary: image.is_primary },
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

  async function removeShirt() {
    if (!product) return
    if (!window.confirm('Delete this shirt and remove its photos from Cloudinary?')) return
    setBusy(true)
    setError('')
    try {
      await request(`/staff/products/${product.id}`, { method: 'DELETE', token: session.token })
      navigate('/staff/products')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
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
          <h1>{isNew ? 'New shirt' : form.name || (canWrite ? 'Edit shirt' : 'Shirt')}</h1>
          <p>
            {isNew
              ? 'Create a draft, then add photos before publishing.'
              : canWrite
                ? 'Update details, stock, and photos.'
                : 'Read-only. Managers change stock, photos, and publish status.'}
          </p>
        </div>
        {product && canDelete ? (
          <div className="dash-tools">
            <button type="button" className="btn ghost" onClick={removeShirt} disabled={busy}>
              Delete shirt
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="error">{error}</p> : null}

      <form className="edit-card" onSubmit={saveBasics}>
        <fieldset disabled={!canWrite}>
          <ShirtEditorFields
            form={form}
            onChange={setForm}
            palette={palette}
            showQty={isNew}
            session={canWrite ? session : null}
            onPaletteChange={setPalette}
            disabled={!canWrite}
          />
          {!isNew ? (
            <label className="publish-toggle">
              <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
              Published on the store
            </label>
          ) : (
            <p className="muted">Save first, then add images, then publish.</p>
          )}
          {canWrite ? (
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : isNew ? 'Create shirt' : 'Save details'}
            </button>
          ) : null}
        </fieldset>
      </form>

      {product ? (
        <>
          <form className="edit-card" onSubmit={saveStock}>
            <p className="form-kicker">Stock on hand</p>
            <p className="muted qty-hint">
              {canWrite ? 'Adjust units after a delivery or a count.' : 'Units currently on hand.'}
            </p>
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
                          disabled={!canWrite}
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
            {canWrite ? (
              <button className="btn ghost" type="submit">
                Save stock
              </button>
            ) : null}
          </form>

          <section className="edit-card">
            <p className="form-kicker">Photos</p>
            <p className="muted qty-hint">
              {canWrite
                ? 'JPEG, PNG or WebP. Pick a colour first, then add as many photos as you need for that colour.'
                : 'Photos grouped by colour.'}
            </p>
            {canWrite ? (
              <>
                <p className="field-label">Colour for new photos</p>
                <div className="choice-row" role="group" aria-label="Upload colour">
                  {product.colors.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      className={`choice-chip${uploadColor === color.id ? ' on' : ''}`}
                      aria-pressed={uploadColor === color.id}
                      onClick={() => setUploadColor(color.id)}
                    >
                      <span className="swatch" style={{ background: color.hex }} />
                      {color.name}
                    </button>
                  ))}
                </div>
                <label className={`upload-btn${uploading || !uploadColor ? ' disabled' : ''}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploading || !uploadColor}
                    onChange={upload}
                  />
                  {uploading ? 'Uploading…' : 'Add photos'}
                </label>
              </>
            ) : null}
            {product.colors.map((color) => {
              const shots = product.images.filter((image) => image.color_id === color.id)
              return (
                <div className="image-group" key={color.id}>
                  <div className="qty-group-head">
                    <span className="swatch" style={{ background: color.hex }} />
                    <strong>{color.name}</strong>
                    <span className="muted">{shots.length} photo{shots.length === 1 ? '' : 's'}</span>
                  </div>
                  {shots.length ? (
                    <div className="image-grid">
                      {shots.map((image) => (
                        <article className="image-card" key={image.id}>
                          <img src={image.url} alt={image.alt_text} />
                          <div className="image-card-body">
                            {canWrite ? (
                              <select value={image.color_id || ''} onChange={(event) => tagImage(image, event.target.value)}>
                                {!image.color_id ? <option value="">Choose colour</option> : null}
                                {product.colors.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            {image.is_primary ? <span className="badge">Primary</span> : null}
                            {canWrite ? (
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
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No photos for this colour yet.</p>
                  )}
                </div>
              )
            })}
            {canWrite && product.images.some((image) => !image.color_id) ? (
              <div className="image-group">
                <div className="qty-group-head">
                  <strong>Needs a colour</strong>
                </div>
                <div className="image-grid">
                  {product.images
                    .filter((image) => !image.color_id)
                    .map((image) => (
                      <article className="image-card" key={image.id}>
                        <img src={image.url} alt={image.alt_text} />
                        <div className="image-card-body">
                          <select value="" onChange={(event) => tagImage(image, event.target.value)}>
                            <option value="">Choose colour</option>
                            {product.colors.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn ghost" onClick={() => removeImage(image)}>
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
