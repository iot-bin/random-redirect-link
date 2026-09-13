import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { '/*': ['./config/bootstrap.local.json'] },
};

export default nextConfig;
