const path = require("path");
const webpack = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react", "@react-three/fiber", "@react-three/drei"],
  },
  compress: true,
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    if (isServer) {
      const patchPath = path.resolve(__dirname, "src", "lib", "x402", "x402VersionPatch.ts");
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\\/]chunk-VE37GDG2\.mjs$/,
          patchPath
        )
      );
    }
    return config;
  },
};

module.exports = nextConfig;
