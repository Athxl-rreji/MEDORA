import './globals.css';

export const metadata = {
  title: 'MEDORA | Delivery Rider',
  description: 'Real-time delivery tracking and order pickup for MEDORA riders.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
