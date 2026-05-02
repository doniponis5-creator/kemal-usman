import React from 'react';

// Simple shimmer skeleton. Pair with the CSS animation `@keyframes shimmer`
// already in src/index.css.

const baseStyle = {
  background:
    'linear-gradient(90deg, #f5f5f5 0%, #ececec 50%, #f5f5f5 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s linear infinite',
  borderRadius: 8,
};

export function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  return (
    <div
      style={{ ...baseStyle, width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minHeight: 220,
    }}>
      <Skeleton width="100%" height={150} radius={0} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width="40%" height={10} />
        <Skeleton width="80%" height={14} />
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <Skeleton width={36} height={16} radius={20} />
          <Skeleton width={36} height={16} radius={20} />
        </div>
        <Skeleton width="50%" height={16} style={{ marginTop: 6 }} />
      </div>
    </div>
  );
}

export function CatalogGridSkeleton({ count = 6 }) {
  return (
    <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}
