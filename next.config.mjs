function positiveIntegerEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

const buildCpus = positiveIntegerEnv("NEXT_BUILD_CPUS");
const staticGenerationMaxConcurrency = positiveIntegerEnv("NEXT_STATIC_GENERATION_MAX_CONCURRENCY");
const experimental = {};

if (buildCpus !== undefined) experimental.cpus = buildCpus;
if (staticGenerationMaxConcurrency !== undefined) {
  experimental.staticGenerationMaxConcurrency = staticGenerationMaxConcurrency;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  ...(Object.keys(experimental).length > 0 ? { experimental } : {}),
  images: {
    unoptimized: true
  },
  env: {},
  webpack: (config, { isServer }) => {
    // Ignore fs/path modules in browser bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    // Stop watching logs directory to prevent HMR during streaming
    config.watchOptions = { ...config.watchOptions, ignored: /[\\/](logs|\.next)[\\/]/ };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/v1/v1/:path*",
        destination: "/api/v1/:path*"
      },
      {
        source: "/v1/v1",
        destination: "/api/v1"
      },
      {
        source: "/codex/:path*",
        destination: "/api/v1/responses"
      },
      {
        source: "/v1/:path*",
        destination: "/api/v1/:path*"
      },
      {
        source: "/v1",
        destination: "/api/v1"
      }
    ];
  }
};

export default nextConfig;
