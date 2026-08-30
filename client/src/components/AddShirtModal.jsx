import { useEffect, useState } from 'react'
import { request } from '../api.js'
import ShirtEditorFields, { buildVariants, emptyShirtForm } from './ShirtEditorFields.jsx'

export default function AddShirtModal({ session, palette: paletteProp, mode = 'stock', onClose, onCreated, onPaletteChange }) {
  const [palette, setPalette] = useState(paletteProp || [])
  const [form, setForm] = useState(() => emptyShirtForm(paletteProp || []))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (paletteProp?.length) {
      setPalette(paletteProp)
      return
    }
    request('/staff/palette/colors', { token: session.token })
      .then((data) => {
        const colors = data.items || []
        setPalette(colors)
        setForm((current) => (current.colorIds.length ? current : emptyShirtForm(colors)))
      })
      .catch(() => {})
  }, [paletteProp, session.token])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, busy])

  async function submit(event) {
    event.preventDefault()
    if (!form.colorIds.length || !form.sizes.length) {
      setError('Pick at least one color and one size.')
      return
    }
    setBusy(true)
    setError('')
    const variants = buildVariants(form)
    try {
      const saved =
        mode === 'catalog'
          ? await request('/staff/products', {
              method: 'POST',
              token: session.token,
              body: {
                name: form.name,
                description: form.description,
                base_price: form.selling_price,
                cost_price: form.cost_price,
                color_ids: form.colorIds,
                sizes: form.sizes,
                variants,
                is_published: false,
              },
            })
          : await request('/staff/stock', {
              method: 'POST',
              token: session.token,
              body: {
                name: form.name,
                description: form.description,
                cost_price: form.cost_price,
                selling_price: form.selling_price,
                color_ids: form.colorIds,
                sizes: form.sizes,
                variants,
              },
            })
      onCreated?.(saved)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'catalog' ? 'New shirt' : 'Add t-shirt'
  const hint =
    mode === 'catalog'
      ? 'Create a draft, then add photos on the next screen before publishing.'
      : 'Receive units into inventory. The shirt stays a draft until you add photos on Shirts.'

  return (
    <div className="modal-back sheet" onClick={() => !busy && onClose()} role="presentation">
      <form
        className="modal-card form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-shirt-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <header className="modal-head">
          <div>
            <p className="eyebrow">{mode === 'catalog' ? 'Catalog' : 'Inventory'}</p>
            <h2 id="add-shirt-title">{title}</h2>
            <p className="muted modal-meta">{hint}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={busy}>
            ×
          </button>
        </header>

        {error ? <p className="error form-error">{error}</p> : null}

        <div className="form-scroll">
          <ShirtEditorFields
            form={form}
            onChange={setForm}
            palette={palette}
            showQty
            session={session}
            onPaletteChange={(colors) => {
              setPalette(colors)
              onPaletteChange?.(colors)
            }}
          />
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : mode === 'catalog' ? 'Create shirt' : 'Add to stock'}
          </button>
        </div>
      </form>
    </div>
  )
}
