import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const localChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.CHROME_PATH ??
  (existsSync(localChrome) ? localChrome : undefined);
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PLAYWRIGHT_PORT must be an integer from 1024 to 65535.");
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    launchOptions: { executablePath },
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    // Own an isolated offline server; never reuse a shopper's live demo.
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      ALONG_AGENT_MODE: "fixture",
      ALONG_E2E: "1",
    },
  },
  reporter: "list",
});
