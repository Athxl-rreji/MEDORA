/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Suppress Webpack cache serialization warning messages
    config.infrastructureLogging = {
      level: 'error',
    };
    return config;
  },
};

module.exports = nextConfig;
