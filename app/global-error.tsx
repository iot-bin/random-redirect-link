'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body style={styles.body}>
        <main style={styles.card} role="alert">
          <p style={styles.code}>500</p>
          <h1 style={styles.title}>应用暂时无法显示</h1>
          <p style={styles.description}>
            发生了意外错误，请重试。 / Something went wrong. Please try again.
          </p>
          <button style={styles.button} type="button" onClick={reset}>
            重试 / Try again
          </button>
        </main>
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    minHeight: '100vh',
    margin: 0,
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    boxSizing: 'border-box',
    background: '#f6f7f9',
    color: '#111827',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: 'min(100%, 520px)',
    padding: 32,
    boxSizing: 'border-box',
    border: '1px solid #d9dde5',
    borderRadius: 16,
    background: '#ffffff',
    textAlign: 'center',
  },
  code: {
    margin: '0 0 8px',
    color: '#6b7280',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.12em',
  },
  title: {
    margin: '0 0 12px',
    fontSize: 24,
  },
  description: {
    margin: '0 0 24px',
    color: '#4b5563',
    lineHeight: 1.6,
  },
  button: {
    minHeight: 40,
    padding: '0 16px',
    border: 0,
    borderRadius: 8,
    background: '#2563eb',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
