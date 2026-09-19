import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pathToBin = join(root, "node_modules", ".bin");
const run = (cmd) =>
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PATH: `${pathToBin};${process.env.PATH}` },
  });

const isLocal = process.argv.includes("--local");

run("tsc -b");
run("vite build");

if (isLocal) {
  const base = loadEnv("production", root, "").VITE_BASE_URL || "/";
  const folder = (base.match(/\/([^/]+)\/?$/) || [])[1];
  if (!folder) {
    console.log(`[build:local] VITE_BASE_URL "${base}" has no path folder; skipping copy`);
  } else {
    const src = join(root, "docs");
    const dest = join(root, folder);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
    console.log(`[build:local] copied built content from docs/ to ${folder}/`);
  }
}