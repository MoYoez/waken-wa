/**
 * Background gradient + 3 floating orbs used by every public route.
 *
 * Server component (no client-side state). The animation/visibility tweaks
 * (prefers-reduced-motion, mobile hide) live in styles/globals/background-effects.css.
 */
export function AnimatedBackdrop() {
  return (
    <div className="animated-bg">
      <div className="floating-orb floating-orb-1" />
      <div className="floating-orb floating-orb-2" />
      <div className="floating-orb floating-orb-3" />
    </div>
  )
}
