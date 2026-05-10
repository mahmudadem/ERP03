import { useState, useEffect } from 'react';

/** Tailwind-aligned breakpoints */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Returns true if viewport width >= the given breakpoint.
 * Uses the same values as Tailwind's default breakpoints.
 */
export function useBreakpoint(bp: Breakpoint): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS[bp] : true
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${BREAKPOINTS[bp]}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setMatches(e.matches);
    handler(mql); // sync on mount
    mql.addEventListener('change', handler as any);
    return () => mql.removeEventListener('change', handler as any);
  }, [bp]);

  return matches;
}

/**
 * Returns the current active breakpoint name.
 */
export function useActiveBreakpoint(): Breakpoint | 'xs' {
  const sm = useBreakpoint('sm');
  const md = useBreakpoint('md');
  const lg = useBreakpoint('lg');
  const xl = useBreakpoint('xl');
  const xxl = useBreakpoint('2xl');
  if (xxl) return '2xl';
  if (xl) return 'xl';
  if (lg) return 'lg';
  if (md) return 'md';
  if (sm) return 'sm';
  return 'xs';
}
