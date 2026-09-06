import React, { useEffect, useRef, useState } from 'react';

function shouldStartVisible() {
  if (typeof window === 'undefined') return true;
  if (typeof window.IntersectionObserver !== 'function') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
}

export default function ScrollReveal({
  as: Tag = 'div',
  children,
  className = '',
  delay = 0,
  style = null,
  ...rest
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(shouldStartVisible);

  useEffect(() => {
    if (visible) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver !== 'function') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, {
      threshold: 0.01,
      rootMargin: '0px 0px 14% 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={`scroll-reveal scroll-reveal--${visible ? 'visible' : 'pending'}${className ? ` ${className}` : ''}`}
      style={{ ...style, '--scroll-reveal-delay': `${Math.max(0, Number(delay) || 0)}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
