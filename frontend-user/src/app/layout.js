import './globals.css';

export const metadata = {
  title: 'MEDORA | Next-Gen AI Pharmacy',
  description: 'AI-Powered Pharmacy Ecosystem for modern quick-commerce delivery.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav-bar">
          <div className="nav-bar-logo gradient-text" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-1px' }}>MEDORA.</div>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <a href="/" style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>Find Medicine</a>
            <a href="#orders" style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>Track Orders</a>
            <button className="btn-secondary" style={{ padding: '0.5rem 1.5rem' }}>Log In</button>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
