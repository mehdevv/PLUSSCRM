import { copyFileSync, existsSync } from "fs";

const index = "dist/index.html";
const fallback = "dist/404.html";

if (!existsSync(index)) {
  console.error("copy-spa-fallback: dist/index.html not found — run vite build first");
  process.exit(1);
}

copyFileSync(index, fallback);
console.log("copy-spa-fallback: dist/404.html created for static hosting");
