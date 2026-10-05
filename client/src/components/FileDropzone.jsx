import { useEffect, useMemo, useRef, useState } from 'react'
import { IconTrash, IconUpload } from './Icons.jsx'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extLabel(file) {
  const name = file.name || 'FILE'
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE'
  return ext.slice(0, 4)
}

export default function FileDropzone({
  files,
  onChange,
  accept = 'image/jpeg,image/png,image/webp',
  multiple = true,
  maxLabel = 'Max file size up to 5 MB',
  title = 'Drop your files here or browse',
}) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const list = files || []
  const previews = useMemo(
    () =>
      list.map((file) => ({
        file,
        url: file.type?.startsWith('image/') ? URL.createObjectURL(file) : '',
      })),
    [list],
  )

  useEffect(() => {
    return () => previews.forEach((item) => item.url && URL.revokeObjectURL(item.url))
  }, [previews])

  function addFiles(next) {
    const incoming = Array.from(next || [])
    if (!incoming.length) return
    onChange(multiple ? [...list, ...incoming] : incoming.slice(0, 1))
  }

  function removeAt(index) {
    onChange(list.filter((_, i) => i !== index))
  }

  return (
    <div className="dropzone">
      <button
        type="button"
        className={`dropzone-pad${drag ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDrag(false)
          addFiles(event.dataTransfer.files)
        }}
      >
        <span className="dropzone-icon">
          <IconUpload />
        </span>
        <strong>{title}</strong>
        <span>{maxLabel}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />
      {previews.length ? (
        <ul className="dropzone-files">
          {previews.map((item, index) => (
            <li key={`${item.file.name}-${index}`}>
              {item.url ? <img src={item.url} alt="" /> : <span className="file-ext">{extLabel(item.file)}</span>}
              <div>
                <strong>{item.file.name}</strong>
                <span>{formatSize(item.file.size)}</span>
              </div>
              <button type="button" className="icon-btn" aria-label={`Remove ${item.file.name}`} onClick={() => removeAt(index)}>
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
