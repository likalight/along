// One server for shopping, Mac preferences and Chrome discovery.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
if (!existsSync(new URL("../apps/shopper/.next/BUILD_ID", import.meta.url))) {
  console.error("Build the integrated app first: npm run build");
  process.exit(1);
}
const endpoint = new URL(
  process.env.ALONG_CONTEXT_URL || "http://127.0.0.1:4339",
);
if (endpoint.hostname !== "127.0.0.1" || endpoint.protocol !== "http:")
  throw new Error("The Mac demo requires a loopback address.");
const configure = spawn(process.execPath, ["scripts/context/configure.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ALONG_CONTEXT_URL: endpoint.origin },
});
configure.on("exit", (code) => {
  if (code !== 0) {
    process.exitCode = code || 1;
    return;
  }
  console.log(
    `Along setup: ${endpoint.origin}/setup\nKeep this process running throughout the demo. Open Along Context and pair Chrome before presenting.`,
  );
  const server = spawn(
    "npm",
    [
      "run",
      "start",
      "-w",
      "@along/shopper",
      "--",
      "--port",
      endpoint.port || "80",
    ],
    { cwd: root, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => {
    process.exitCode = code || 0;
  });
});
