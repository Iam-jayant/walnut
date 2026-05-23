import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  outputFileTracingRoot: workspaceRoot,
  webpack: (config, { dev }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": false,
    };

    if (dev) {
      // Avoid flaky filesystem cache ENOENT issues on Windows during route recompiles.
      config.cache = {
        type: "memory",
      };

      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          "**/.git/**",
          "**/.next/**",
          "**/artifacts/**",
          "**/cache/**",
          "**/build-info/**",
          "**/test/**",
        ],
      };
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /Circular dependency between chunks with runtime/,
    ];

    return config;
  },
};

export default nextConfig;

// trigger rebuild
