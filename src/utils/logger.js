// src/utils/logger.js
// Dev: full logging. Prod: every dev-only method is `noop` resolved at module
// load. This lets terser see `logger.log("X")` as a call to a function whose
// body is `() => {}` and (with pure_funcs in vite.config.js) elide the whole
// expression — including the argument string — at the call site.
//
// console.warn / console.error are kept in BOTH environments so Sentry's
// breadcrumb capture has something to grab onto.

const isDev = import.meta.env.DEV
const noop = () => {}

export const logger = isDev
  ? {
      log:   (...args) => console.log(...args),
      info:  (...args) => console.info(...args),
      warn:  (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
      step:  (step, ...args) => console.log(`[STEP ${step}]`, ...args),
      group: (label) => console.group(label),
      groupEnd: ()   => console.groupEnd(),
    }
  : {
      log:   noop,
      info:  noop,
      warn:  (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
      step:  noop,
      group: noop,
      groupEnd: noop,
    }

export default logger
