/** Fluid Functionalism @ 7e6ae29, registry/default/lib/springs.ts.
 * Enter uses the spring tier; exit uses the matching, quicker tween. */
export const spring = {
  fast: {
    type: 'spring' as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  moderate: {
    type: 'spring' as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  slow: {
    type: 'spring' as const,
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
} as const;

/** Source fallback for a stalled exit: its duration plus a 100ms buffer. */
export const exitFallbackMs = (tier: { readonly exit: { readonly duration: number } }): number =>
  Math.round(tier.exit.duration * 1000) + 100;
