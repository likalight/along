import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4324);
export default defineConfig({
  testDir: "tests/extension-browser",
  timeout: 90000,
  workers: 1,
  outputDir: "test-results/extension",
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      ALONG_DISCOVERY_PROVIDER: "",
      ALONG_DISCOVERY_VISION: "false",
    },
  },
});
