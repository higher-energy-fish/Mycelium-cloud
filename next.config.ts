import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // 在浏览器端禁用 canvas
    if (!isServer) {
      config.resolve.alias.canvas = false;
    }

    return config;
  },
  serverExternalPackages: ['canvas'], // 告诉 Next.js canvas 是外部包
  turbopack: {}, // 添加空的 turbopack 配置以消除警告
  // 提高请求体上限至 200MB，支持大 PDF 上传（默认 10MB）
  // Next.js 16 使用 proxyClientMaxBodySize（middlewareClientMaxBodySize 已废弃）
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
};

export default nextConfig;
