/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Turbopack configuration
  experimental: {
    turbo: {
      // Configure Turbopack rules
      rules: {
        // Configure external packages
        external: ['socket.io-client']
      },
      // Correct loader format
      loaders: {
        '.js': ['jsx']  // Array format instead of string
      }
    }
  },
  // Webpack configuration
  webpack: (config) => {
    config.externals = [...(config.externals || []), { 
      bufferutil: "bufferutil", 
      "utf-8-validate": "utf-8-validate" 
    }];
    return config;
  },
  // Socket.IO rewrites
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3001/socket.io/:path*',
      },
    ];
  }
};

export default nextConfig; 