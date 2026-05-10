import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 640) {
  const [below, setBelow] = useState(
    () => typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setBelow(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return below;
}
