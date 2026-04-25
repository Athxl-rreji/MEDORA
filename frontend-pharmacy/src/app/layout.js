import './globals.css';

export const metadata = {
  title: 'MEDORA | Pharmacy Dashboard',
  description: 'Manage Instamart delivery queues and inventory OCR.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <h2>MEDORA. <span style={{ fontWeight: 400, opacity: 0.8 }}>Pharmacy Portal</span></h2>
          <div>
            <span style={{ marginRight: '1rem' }}>Vamanjoor Pharmacy, Mangalore</span>
            <button style={{ padding: '0.4rem 1rem', borderRadius: '4px', border: 'none', color: 'var(--primary)', fontWeight: 'bold' }}>● Live</button>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
