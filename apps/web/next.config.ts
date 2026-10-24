import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coupang/agent", "@coupang/contract"],
};

export default nextConfig;
