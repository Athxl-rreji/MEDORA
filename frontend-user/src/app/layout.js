import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'MEDORA | Next-Gen AI Pharmacy',
  description: 'AI-Powered Pharmacy Ecosystem for modern quick-commerce delivery.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
