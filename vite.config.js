import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

// Консультант «Спросить» в локальном предпросмотре (`npm run dev`).
// На сервере тот же запрос обслуживает pb_hooks/assistant.pb.js; здесь — та же
// логика (pb_hooks/_lib/assistant_core.js), каталог читается с боевого PocketBase
// только на чтение. GEMINI_API_KEY в локальном .env — ИИ отвечает по-настоящему;
// без ключа — ответ без ИИ, как на сервере без ключа. В сборку это не попадает.
function assistantDevServer() {
  const core = createRequire(import.meta.url)('./pb_hooks/_lib/assistant_core.js')
  let env = {}
  let cache = null
  const loadCatalog = async () => {
    if (cache && Date.now() - cache.at < 300000) return cache
    const base = (env.VITE_PB_URL || 'https://api.kemalusman.kg').replace(/\/$/, '')
    const products = []
    for (let page = 1; page < 20; page++) {
      const r = await fetch(`${base}/api/collections/products/records?perPage=500&page=${page}`).then(x => x.json())
      products.push(...(r.items || []))
      if (page >= (r.totalPages || 1)) break
    }
    const st = await fetch(`${base}/api/collections/settings/records?perPage=1`).then(x => x.json())
    cache = { at: Date.now(), products, settings: st.items?.[0] || {} }
    return cache
  }
  return {
    name: 'assistant-dev-server',
    apply: 'serve',
    configResolved(config) { env = loadEnv(config.mode, config.root, '') },
    configureServer(server) {
      server.middlewares.use('/api/custom/assistant', (req, res) => {
        let raw = ''
        req.on('data', (d) => { raw += d })
        req.on('end', async () => {
          const send = (status, body) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)) }
          try {
            const input = JSON.parse(raw || '{}')
            const { products, settings } = await loadCatalog()
            const prepared = core.prepare(input, products, settings, Date.now())
            if (!prepared.ok) return send(400, { error: prepared.error })
            let answer = null
            if (env.GEMINI_API_KEY) {
              const model = env.GEMINI_MODEL || 'gemini-3.8-flash'
              const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
                body: JSON.stringify(prepared.body),
                signal: AbortSignal.timeout(25000),
              })
              if (r.ok) answer = core.finish(prepared, await r.json())
              else console.warn('[assistant] gemini', r.status, (await r.text()).slice(0, 300))
            }
            const mode = answer ? 'ai' : 'fallback'
            if (!answer) answer = core.fallbackReply(prepared, input.lang)
            if (answer.usage) console.info(`[assistant] токены: ввод ${answer.usage.input}, из кэша ${answer.usage.cached}, ответ ${answer.usage.output}`)
            send(200, { reply: answer.reply, productIds: answer.productIds, handoff: answer.handoff, mode })
          } catch (e) {
            console.warn('[assistant]', e)
            send(500, { error: 'internal' })
          }
        })
      })
    },
  }
}

// Vite 8 (rolldown-vite). `rollupOptions` is a back-compat alias for
// `rolldownOptions`, so manualChunks lives there. Terser is opted-in
// explicitly because we need its `pure_funcs` to strip ONLY log/info/debug
// while keeping console.warn / console.error (Sentry captures those).
export default defineConfig({
  plugins: [react(), assistantDevServer()],
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
