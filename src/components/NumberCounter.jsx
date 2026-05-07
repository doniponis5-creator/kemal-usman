import React, { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

// Counts smoothly from 0 (or `from`) up to `value`. Fires on mount and
// every time `value` changes. Pure number text; safe inside any element.
//
//   <NumberCounter value={1500} />            → 1,500
//   <NumberCounter value={42} duration={0.8} />
//   <NumberCounter value={3.14} format={v => v.toFixed(2)} />

export function NumberCounter({
  value,
  from = 0,
  duration = 1.0,
  delay = 0,
  format = (v) => Math.round(v).toLocaleString(),
}) {
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    const controls = animate(from, value, {
      duration,
      delay,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{format(display)}</span>;
}
