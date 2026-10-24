import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@concierge/backend"],
  transpilePackages: ["@coupang/agent", "@coupang/contract"],
};

export default nextConfig;
