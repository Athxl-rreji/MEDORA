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
        <Script 
          src="/youpi-checkout.js" 
          strategy="lazyOnload" 
          data-name="MEDORA Sovereign Healthcare" 
          data-theme-color="#14b8a6" 
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
