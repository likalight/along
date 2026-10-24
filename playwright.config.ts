import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const localChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.CHROME_PATH ??
  (existsSync(localChrome) ? localChrome : undefined);
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    launchOptions: { executablePath },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
