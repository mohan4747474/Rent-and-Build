const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const source = path.join(root, "artifacts", "rentbuild-india", "dist", "public");
const target = path.join(root, "artifacts", "rentbuild-india", "dist", "rentbuild-india-web");

if (!fs.existsSync(source)) {
  console.error("Frontend build output is missing. Run `pnpm run build:web` first.");
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

const manifest = {
  name: "rentbuild-india-web",
  version: "1.0.0",
  generatedAt: new Date().toISOString(),
  source: "artifacts/rentbuild-india",
  entrypoint: "index.html",
  serveCommand: "pnpm --filter @workspace/rentbuild-india serve",
  apiBaseUrl: process.env.VITE_API_URL || "http://localhost:3000/api",
};

fs.writeFileSync(
  path.join(target, "artifact-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Packaged frontend artifact: ${path.relative(root, target)}`);
