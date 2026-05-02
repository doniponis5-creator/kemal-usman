import React from 'react';

// Catches rendering errors anywhere in the React tree below it. Without this,
// one stray exception (like the original `setOrderLoading is not defined`)
// turns into a white screen on iOS WKWebView with no way to recover.
//
// Sentry hookup: pass VITE_SENTRY_DSN in .env, install @sentry/react, wrap
// componentDidCatch -> Sentry.captureException(err, { extra: info }).

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
    if (window.__sentry__) window.__sentry__.captureException(error, { extra: info });
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16,
        background: '#111', color: '#fff', fontFamily: '-apple-system, sans-serif',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Что-то пошло не так</div>
        <div style={{ fontSize: 14, opacity: 0.7, maxWidth: 320 }}>
          Приложение столкнулось с ошибкой. Попробуйте обновить страницу — если ошибка повторится, напишите нам.
        </div>
        <button
          onClick={() => { this.reset(); window.location.reload(); }}
          style={{
            marginTop: 12, padding: '12px 28px', borderRadius: 12,
            border: 'none', background: '#fff', color: '#111',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Перезагрузить
        </button>
        {import.meta.env.DEV && (
          <pre style={{
            marginTop: 16, fontSize: 11, opacity: 0.5, maxWidth: '90%',
            overflow: 'auto', textAlign: 'left',
          }}>{String(this.state.error?.stack || this.state.error)}</pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
