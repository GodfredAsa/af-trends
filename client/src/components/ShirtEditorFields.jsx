import { useState } from 'react'
import { request } from '../api.js'
import { PRIV, can } from '../privileges.js'

export const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function emptyShirtForm(palette = []) {
  return {
    name: '',
    description: '',
    cost_price: '60.00',
    selling_price: '120.00',
    colorIds: palette.slice(0, 2).map((color) => color.id),
    sizes: ['S', 'M', 'L', 'XL'],
    qty: {},
  }
}

export function buildVariants(form) {
  const variants = []
  form.colorIds.forEach((colorId) => {
    form.sizes.forEach((size) => {
      variants.push({
        color_id: colorId,
        size,
        stock: Number(form.qty[`${colorId}:${size}`] || 0),
      })
    })
  })
  return variants
}

export default function ShirtEditorFields({
  form,
  onChange,
  palette,
  showQty = true,
  session,
  onPaletteChange,
  disabled = false,
}) {
  const colorMap = Object.fromEntries(palette.map((color) => [color.id, color]))
  const canManagePalette = can(session?.user, PRIV.SETTINGS_MANAGE)
  const [newName, setNewName] = useState('')
  const [newHex, setNewHex] = useState('#2A3B30')
  const [colorError, setColorError] = useState('')
  const [savingColor, setSavingColor] = useState(false)

  function patch(next) {
    onChange({ ...form, ...next })
  }

  async function saveColor() {
    if (!newName.trim()) {
      setColorError('Give the colour a name.')
      return
    }
    setSavingColor(true)
    setColorError('')
    try {
      const created = await request('/staff/palette/colors', {
        method: 'POST',
        token: session.token,
        body: { name: newName.trim(), hex: newHex },
      })
      onPaletteChange?.([...(palette || []), created])
      if (!form.colorIds.includes(created.id)) {
        patch({ colorIds: [...form.colorIds, created.id] })
      }
      setNewName('')
    } catch (err) {
      setColorError(err.message)
    } finally {
      setSavingColor(false)
    }
  }

  async function removePaletteColor(color) {
    if (!window.confirm(`Remove ${color.name} from the palette?`)) return
    setColorError('')
    try {
      await request(`/staff/palette/colors/${color.id}`, { method: 'DELETE', token: session.token })
      onPaletteChange?.((palette || []).filter((item) => item.id !== color.id))
    } catch (err) {
      setColorError(err.message)
    }
  }

  function toggle(key, value) {
    const current = form[key]
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    patch({ [key]: next })
  }

  function setQty(colorId, size, value) {
    patch({ qty: { ...form.qty, [`${colorId}:${size}`]: value } })
  }

  return (
    <div className="shirt-form">
      <section className="form-block">
        <p className="form-kicker">1. Details</p>
        <label htmlFor="shirt-name">Name</label>
        <input
          id="shirt-name"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="Harbor Stripe Tee"
          autoComplete="off"
          required
          disabled={disabled}
        />
        <label htmlFor="shirt-desc">Description</label>
        <textarea
          id="shirt-desc"
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="Fit, fabric, and what makes this tee worth wearing."
          disabled={disabled}
        />
        <div className="stock-prices">
          <div>
            <label htmlFor="shirt-cost">Cost price (GHS)</label>
            <input
              id="shirt-cost"
              inputMode="decimal"
              value={form.cost_price}
              onChange={(event) => patch({ cost_price: event.target.value })}
              required
              disabled={disabled}
            />
          </div>
          <div>
            <label htmlFor="shirt-sell">Selling price (GHS)</label>
            <input
              id="shirt-sell"
              inputMode="decimal"
              value={form.selling_price}
              onChange={(event) => patch({ selling_price: event.target.value })}
              required
              disabled={disabled}
            />
          </div>
        </div>
      </section>

      <section className="form-block">
        <p className="form-kicker">2. Colors & sizes</p>
        <p className="field-label">Colors in stock</p>
        <div className="choice-row" role="group" aria-label="Colors">
          {palette.map((color) => {
            const on = form.colorIds.includes(color.id)
            return (
              <span key={color.id} className={`choice-chip-wrap${on ? ' on' : ''}`}>
                <button
                  type="button"
                  className={`choice-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggle('colorIds', color.id)}
                >
                  <span className="swatch" style={{ background: color.hex }} />
                  {color.name}
                </button>
                {!on && canManagePalette && !disabled ? (
                  <button
                    type="button"
                    className="chip-delete"
                    aria-label={`Delete ${color.name}`}
                    onClick={() => removePaletteColor(color)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            )
          })}
        </div>
        {session && !disabled ? (
          <div className="color-create">
            <div>
              <label htmlFor="new-color-name">New colour</label>
              <input
                id="new-color-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Olive, Kente gold…"
                autoComplete="off"
              />
            </div>
            <label className="color-swatch-pick" htmlFor="new-color-hex">
              <span className="field-label">Hex</span>
              <input
                id="new-color-hex"
                type="color"
                value={newHex}
                onChange={(event) => setNewHex(event.target.value)}
                aria-label="Colour hex"
              />
            </label>
            <button type="button" className="btn ghost" onClick={saveColor} disabled={savingColor || !session}>
              {savingColor ? 'Saving…' : 'Save colour'}
            </button>
            {colorError ? <p className="error color-create-error">{colorError}</p> : null}
          </div>
        ) : null}
        <p className="field-label">Sizes</p>
        <div className="choice-row" role="group" aria-label="Sizes">
          {ALL_SIZES.map((size) => {
            const on = form.sizes.includes(size)
            return (
              <button
                key={size}
                type="button"
                className={`choice-chip size${on ? ' on' : ''}`}
                aria-pressed={on}
                disabled={disabled}
                onClick={() => toggle('sizes', size)}
              >
                {size}
              </button>
            )
          })}
        </div>
      </section>

      {showQty && form.colorIds.length && form.sizes.length ? (
        <section className="form-block">
          <p className="form-kicker">3. Quantity</p>
          <p className="muted qty-hint">Units received for each color and size. Leave at 0 if it is not in yet.</p>
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
                        onChange={(event) => setQty(colorId, size, event.target.value)}
                        disabled={disabled}
                        aria-label={`${colorMap[colorId]?.name || 'Color'} ${size}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
