import { defineConfig } from "@playwright/test";
import sessionConfig from "./playwright.config";

export default defineConfig({
  ...sessionConfig,
  testDir: "tests/canvas/browser",
  testMatch: "**/*.pw.ts",
});
