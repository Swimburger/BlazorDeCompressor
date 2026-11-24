import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { socialCardFormats } from "./social-card-formats.mjs";

const requireFromE2E = createRequire(new URL("../e2e/package.json", import.meta.url));
const { chromium } = requireFromE2E("@playwright/test");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const templateUrl = pathToFileURL(path.join(scriptDirectory, "social-card.html")).toString();
const outputDirectory = path.join(scriptDirectory, "..", "wwwroot", "assets", "social");

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(templateUrl, { waitUntil: "load" });

  for (const format of socialCardFormats) {
    await page.evaluate(({ slug, displayName, extension, accent, accentSoft }) => {
      document.documentElement.style.setProperty("--accent", accent);
      document.documentElement.style.setProperty("--accent-soft", accentSoft);
      document.querySelector("#format-name").textContent = `${displayName} files`;
      document.querySelector("#extension").textContent = extension;
      document.querySelector("#hostname").textContent = `${slug}.swimburger.net`;
    }, format);

    await page.screenshot({
      path: path.join(outputDirectory, `${format.slug}.png`),
      type: "png",
      animations: "disabled",
    });
  }
} finally {
  await browser.close();
}
