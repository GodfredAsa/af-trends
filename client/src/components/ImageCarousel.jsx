import { useEffect, useRef, useState } from 'react'
import { IconChevron } from './Icons.jsx'

export default function ImageCarousel({
  images = [],
  alt = '',
  className = '',
  index,
  onIndexChange,
  autoPlay = false,
  showArrows = true,
}) {
  const slides = (images || []).filter((image) => image?.url)
  const [internal, setInternal] = useState(0)
  const controlled = typeof index === 'number'
  const currentIndex = slides.length ? Math.min(Math.max(controlled ? index : internal, 0), slides.length - 1) : 0
  const indexRef = useRef(currentIndex)
  const onChangeRef = useRef(onIndexChange)
  indexRef.current = currentIndex
  onChangeRef.current = onIndexChange

  useEffect(() => {
    if (!controlled) setInternal(0)
  }, [slides.map((image) => image.url).join('|'), controlled])

  useEffect(() => {
    if (!autoPlay || slides.length < 2) return undefined
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % slides.length
      if (controlled) onChangeRef.current?.(next)
      else setInternal(next)
    }, 4500)
    return () => clearInterval(timer)
  }, [slides.length, controlled, autoPlay])

  if (!slides.length) return <div className={`photo-carousel empty ${className}`} />

  const current = slides[currentIndex]
  const many = slides.length > 1

  function go(event, nextIndex) {
    event.preventDefault()
    event.stopPropagation()
    const wrapped = (nextIndex + slides.length) % slides.length
    if (controlled) onIndexChange?.(wrapped)
    else setInternal(wrapped)
  }

  return (
    <div className={`photo-carousel ${showArrows ? '' : 'compact'} ${className}`}>
      <img src={current.url} alt={current.alt_text || alt} />
      {many ? (
        <>
          {showArrows ? (
            <>
              <button type="button" className="carousel-nav prev" aria-label="Previous image" onClick={(event) => go(event, currentIndex - 1)}>
                <IconChevron style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button type="button" className="carousel-nav next" aria-label="Next image" onClick={(event) => go(event, currentIndex + 1)}>
                <IconChevron />
              </button>
            </>
          ) : null}
          <div className="carousel-dots" role="tablist" aria-label="Product photos">
            {slides.map((image, i) => (
              <button
                key={image.id || image.url}
                type="button"
                className={i === currentIndex ? 'on' : ''}
                aria-label={`Photo ${i + 1}`}
                onClick={(event) => go(event, i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function productSlides(product) {
  if (product?.images?.length) return product.images
  return product?.primary_image ? [product.primary_image] : []
}
