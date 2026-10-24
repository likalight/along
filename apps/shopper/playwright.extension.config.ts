import { defineConfig } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4324);
// Isolated context store: never read or alter the presenter’s real memories.
const contextDirectory =
  process.env.ALONG_E2E_CONTEXT ??
  mkdtempSync(path.join(tmpdir(), "along-context-e2e-"));
if (!process.env.ALONG_E2E_CONTEXT) {
  process.env.ALONG_E2E_CONTEXT = contextDirectory;
  writeFileSync(
    path.join(contextDirectory, "connection.json"),
    JSON.stringify({
      endpoint: `http://127.0.0.1:${port}`,
      token: randomBytes(32).toString("hex"),
    }),
    { mode: 0o600 },
  );
}
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
    reuseExistingServer: false,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      ALONG_CONTEXT_DIRECTORY: contextDirectory,
      ALONG_AGENT_MODE: "fixture",
      ALONG_E2E: "1",
      ALONG_DISCOVERY_PROVIDER: "",
      ALONG_DISCOVERY_VISION: "false",
    },
  },
});
