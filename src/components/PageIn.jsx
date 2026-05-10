import { useState, useEffect } from 'react';

export default function PageIn({ children, k }) {
  const [r, setR] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setR(true));
    return () => cancelAnimationFrame(raf);
  }, [k]);
  return (
    <div style={{
      opacity: r ? 1 : 0,
      transform: r ? 'none' : 'translateY(16px) scale(.99)',
      transition: 'opacity .42s cubic-bezier(.22,1,.36,1), transform .42s cubic-bezier(.22,1,.36,1)',
      willChange: 'opacity, transform'
    }}>
      {children}
    </div>
  );
}
