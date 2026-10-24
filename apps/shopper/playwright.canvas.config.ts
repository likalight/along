import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "tests/canvas/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3004",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ?? (existsSync(chrome) ? chrome : undefined),
    },
  },
  webServer: {
    command: "npm run dev -- --webpack --port 3004",
    url: "http://127.0.0.1:3004/canvas-preview",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
