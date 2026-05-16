import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module:
          /@prisma\/instrumentation\/node_modules\/@opentelemetry\/instrumentation\/build\/esm\/platform\/node\/instrumentation\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

export default nextConfig;
