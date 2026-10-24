import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.ALONG_E2E === "1" ? ".next-e2e" : ".next",
  serverExternalPackages: ["@concierge/backend"],
  transpilePackages: ["@coupang/agent", "@coupang/contract"],
};
export default config;
