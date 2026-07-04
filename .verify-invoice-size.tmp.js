const { chromium } = require("playwright");

const SCREENSHOT_DIR = __dirname;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("PAGEERROR: " + err.message));

  try {
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-login.png` });

    const pinInput = page.locator('input[type="password"]');
    await pinInput.fill("111111");
    await page.getByRole("button", { name: "Masuk" }).click();

    await page.waitForURL("**/dashboard", { timeout: 15000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-dashboard.png` });
    console.log("LOGIN_OK");

    await page.goto("http://localhost:3000/servis", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-servis-list.png` });

    // Klik tombol aksi (Detail/dsb) di baris pertama tabel servis untuk buka popup detail
    const actionBtn = page.locator("table tbody tr td button").first();
    const btnCount = await page.locator("table tbody tr td button").count();
    console.log("ACTION_BTN_COUNT", btnCount);
    if (btnCount === 0) {
      console.log("NO_ACTION_BUTTONS_FOUND");
      await browser.close();
      return;
    }
    await actionBtn.click();
    await page.waitForSelector("#servis-detail-overlay", { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-detail-popup.png` });

    const previewBtn = page.getByRole("button", { name: /preview/i });
    await previewBtn.first().click();
    await page.waitForSelector("#servis-invoice-preview-overlay", { timeout: 10000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-invoice-preview-modal.png` });

    const picker = page.locator("#servis-invoice-preview-overlay select");
    const pickerVisible = await picker.isVisible().catch(() => false);
    console.log("PICKER_VISIBLE", pickerVisible);

    const pageBoxBefore = await page.locator("#servis-invoice-preview-overlay .shadow-lg.ring-1").boundingBox();
    console.log("BOX_BEFORE_A5", JSON.stringify(pageBoxBefore));

    await picker.selectOption("thermal-58");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-thermal58.png` });
    const pageBoxThermal = await page.locator("#servis-invoice-preview-overlay .shadow-lg.ring-1").boundingBox();
    console.log("BOX_THERMAL58", JSON.stringify(pageBoxThermal));

    await picker.selectOption("custom");
    await page.waitForTimeout(300);
    const numberInputs = page.locator('#servis-invoice-preview-overlay input[type="number"]');
    const inputCount = await numberInputs.count();
    console.log("CUSTOM_INPUT_COUNT", inputCount);
    await numberInputs.nth(0).fill("120");
    await numberInputs.nth(1).fill("180");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07-custom-120x180.png` });
    const pageBoxCustom = await page.locator("#servis-invoice-preview-overlay .shadow-lg.ring-1").boundingBox();
    console.log("BOX_CUSTOM_120x180", JSON.stringify(pageBoxCustom));

    console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors));
    console.log("DONE_OK");
  } catch (e) {
    console.log("FAILED:", e.message);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/ERROR.png` }).catch(() => {});
    console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors));
  } finally {
    await browser.close();
  }
})();
