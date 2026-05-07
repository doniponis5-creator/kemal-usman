import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 8 (rolldown-vite). `rollupOptions` is a back-compat alias for
// `rolldownOptions`, so manualChunks lives there. Terser is opted-in
// explicitly because we need its `pure_funcs` to strip ONLY log/info/debug
// while keeping console.warn / console.error (Sentry captures those).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        // Spec also asked for `drop_console: true`, but that strips warn/error
        // too — contradicts the spec's own comment that they should survive
        // for Sentry. `pure_funcs` is the correct knob here: optimizer treats
        // each listed call as side-effect-free → safe to remove.
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    rollupOptions: {
      output: {
        // Rolldown-vite expects a function, not the rollup-style object map.
        // Splitting strategy:
        //   • `vendor`        — react / react-dom (rarely changes; long cache)
        //   • `pocketbase`    — PB SDK (cached separately; can be re-fetched
        //                       independently when PB SDK upgrades)
        //   • `sentry`        — error tracker (~80 KB; only useful in prod
        //                       once a DSN is set; isolating means a Sentry
        //                       bump doesn't bust the app cache)
        //   • `motion`        — framer-motion (largest single dep apart from
        //                       react; isolating shrinks the app chunk by
        //                       ~30-40% and keeps animation upgrades cheap)
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor';
          }
          if (id.includes('node_modules/pocketbase/')) {
            return 'pocketbase';
          }
          if (id.includes('framer-motion') || id.includes('node_modules/motion-')) {
            return 'motion';
          }
          // Note: @sentry packages are not passed through manualChunks by
          // rolldown-vite (it pre-bundles them). They land in the main app
          // chunk; tree-shaking keeps the actual cost low because we only
          // touch init / captureException / setUser. If a sentry chunk
          // becomes important, switch to advancedChunks (rolldown-only).
          return undefined;
        },
      },
    },
  },
})
