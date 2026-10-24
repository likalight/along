import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@concierge/backend"],
  transpilePackages: ["@coupang/agent", "@coupang/contract"],
};
export default config;
