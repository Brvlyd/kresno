const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.locator('input[type="password"]').fill("111111");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.goto("http://localhost:3000/pegadaian", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: ".debug-pegadaian.png", fullPage: false });
})().catch(e => console.log("ERR", e.message));
