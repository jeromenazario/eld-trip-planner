import { useState, useEffect } from 'react';

// Single source of truth for the mobile breakpoint. Structural layout switches
// (sidebar → drawer, multi-column → stacked) read this; cosmetic tweaks live in
// the matching `@media (max-width: 768px)` blocks in index.css.
export default function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
