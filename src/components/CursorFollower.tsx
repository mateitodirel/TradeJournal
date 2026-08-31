import { useEffect, useRef, useState } from 'react'

const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [role="button"], .card--interactive'

const DOT_LERP = 0.2
const RING_LERP = 0.1

/**
 * A cursor-following dot + ring, rendered once at the app root.
 *
 * Performance: position updates never touch React state. Raw mouse
 * position and the lerped dot/ring positions live in refs; a single
 * requestAnimationFrame loop writes `transform: translate3d(...)`
 * directly onto the DOM nodes each frame.
 *
 * Hover detection uses event delegation on `document` (mouseover/mouseout)
 * so it works for elements that don't exist yet at mount time — modals,
 * dynamically rendered table rows, etc.
 *
 * Gated on `(pointer: fine)` and `(prefers-reduced-motion: reduce)`;
 * renders nothing when either condition says the follower shouldn't run.
 */
export function CursorFollower() {
  const [active, setActive] = useState(false)

  const dotRef = useRef<HTMLDivElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)

  // Raw target position (latest mouse coordinates) and the current lerped
  // positions for dot and ring, all mutated outside React state/render.
  const startPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const target = useRef({ ...startPos })
  const dotPos = useRef({ ...startPos })
  const ringPos = useRef({ ...startPos })
  const rafId = useRef<number | null>(null)

  // Decide whether the follower should be mounted at all: fine pointer +
  // no reduced-motion preference. Re-evaluated live if either media query changes.
  useEffect(() => {
    const pointerQuery = window.matchMedia('(pointer: fine)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const evaluate = () => {
      setActive(pointerQuery.matches && !motionQuery.matches)
    }

    evaluate()

    pointerQuery.addEventListener('change', evaluate)
    motionQuery.addEventListener('change', evaluate)
    return () => {
      pointerQuery.removeEventListener('change', evaluate)
      motionQuery.removeEventListener('change', evaluate)
    }
  }, [])

  // Mouse tracking + hover delegation + the rAF lerp loop.
  useEffect(() => {
    if (!active) return

    const handleMove = (e: MouseEvent) => {
      target.current.x = e.clientX
      target.current.y = e.clientY
    }

    const handleOver = (e: MouseEvent) => {
      const el = e.target as Element | null
      if (el?.closest?.(INTERACTIVE_SELECTOR)) {
        ringRef.current?.classList.add('cursor-follower__ring--hover')
      }
    }

    const handleOut = (e: MouseEvent) => {
      const el = e.target as Element | null
      if (el?.closest?.(INTERACTIVE_SELECTOR)) {
        ringRef.current?.classList.remove('cursor-follower__ring--hover')
      }
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    document.addEventListener('mouseover', handleOver, true)
    document.addEventListener('mouseout', handleOut, true)

    const tick = () => {
      dotPos.current.x += (target.current.x - dotPos.current.x) * DOT_LERP
      dotPos.current.y += (target.current.y - dotPos.current.y) * DOT_LERP
      ringPos.current.x += (target.current.x - ringPos.current.x) * RING_LERP
      ringPos.current.y += (target.current.y - ringPos.current.y) * RING_LERP

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dotPos.current.x}px, ${dotPos.current.y}px, 0)`
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`
      }

      rafId.current = requestAnimationFrame(tick)
    }
    rafId.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseover', handleOver, true)
      document.removeEventListener('mouseout', handleOut, true)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [active])

  // Scope OS-cursor hiding to when the follower is actually active.
  useEffect(() => {
    if (!active) return
    document.body.classList.add('cursor-follower-active')
    return () => {
      document.body.classList.remove('cursor-follower-active')
    }
  }, [active])

  if (!active) return null

  return (
    <>
      <div ref={dotRef} className="cursor-follower__dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-follower__ring" aria-hidden="true" />
    </>
  )
}
