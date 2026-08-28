import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { readDocxText } from "../fileReaders.js";

async function withPage(task, options = {}) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: true,
    ...(options.downloadsPath ? { downloadsPath: options.downloadsPath } : {})
  });
  const page = await context.newPage();
  try {
    return await task(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function runSourceWebsiteWorkflow(config, uploadPath) {
  if (!config?.url) {
    throw new Error("sourceWebsite.url is not configured.");
  }

  if (config.provider === "extractorpro") {
    return runExtractorProPdfToWord(config, uploadPath);
  }

  return runGenericWebsiteWorkflow(config, uploadPath);
}

async function runGenericWebsiteWorkflow(config, uploadPath) {
  return withPage(async (page) => {
    await page.goto(config.url, { waitUntil: "domcontentloaded" });
    await page.setInputFiles(config.fileInputSelector, uploadPath);
    await page.click(config.submitSelector);

    const download = await waitForPossibleDownload(page, config.downloadTimeoutMs);
    if (download) {
      return readDownloadedText(download, config.downloadDir);
    }

    await page.waitForSelector(config.outputTextSelector, { timeout: 120000 });
    return page.locator(config.outputTextSelector).innerText();
  }, { downloadsPath: config.downloadDir });
}

async function runExtractorProPdfToWord(config, uploadPath) {
  const downloadDir = path.resolve(config.downloadDir ?? "storage/downloads/extractorpro");
  await fs.mkdir(downloadDir, { recursive: true });

  return withPage(async (page) => {
    await page.goto(config.url, { waitUntil: "networkidle", timeout: 60000 });
    await loginToExtractorProIfConfigured(page, config.auth, downloadDir);
    await ensureExtractorProHomeReady(page, downloadDir);
    await page.locator("button.category-card.iris").click();
    await page.getByRole("button", { name: /PDF to Word/i }).click();
    await page.setInputFiles("#file-input", uploadPath);

    const downloadPromise = page.waitForEvent("download", {
      timeout: config.downloadTimeoutMs ?? 180000
    });
    await page.locator("#start-btn").click();

    const download = await downloadPromise;
    return readDownloadedText(download, downloadDir);
  }, { downloadsPath: downloadDir });
}

async function loginToExtractorProIfConfigured(page, authConfig, downloadDir) {
  if (!authConfig?.emailEnv || !authConfig?.passwordEnv) return;

  const email = process.env[authConfig.emailEnv];
  const password = process.env[authConfig.passwordEnv];
  if (!email || !password) return;

  await page.locator("button.profile-trigger").click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^Login$/i }).last().click();
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});

  const loginStillVisible = await page.locator('input[name="password"]').isVisible().catch(() => false);
  if (loginStillVisible) {
    await saveDebugScreenshot(page, downloadDir, "extractorpro-login-failed.png");
    throw new Error("ExtractorPro login did not complete. Check EXTRACTORPRO_EMAIL and EXTRACTORPRO_PASSWORD in .env.");
  }
}

async function ensureExtractorProHomeReady(page, downloadDir) {
  try {
    await page.locator("button.category-card.iris").waitFor({ state: "visible", timeout: 60000 });
  } catch {
    await saveDebugScreenshot(page, downloadDir, "extractorpro-home-not-ready.png");
    const visibleText = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
    throw new Error(`ExtractorPro Convert card was not visible after login/navigation. Visible page text: ${visibleText}`);
  }
}

async function saveDebugScreenshot(page, downloadDir, name) {
  const screenshotPath = path.join(downloadDir, name);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
}

async function waitForPossibleDownload(page, timeoutMs = 120000) {
  try {
    return await page.waitForEvent("download", { timeout: timeoutMs });
  } catch {
    return null;
  }
}

async function readDownloadedText(download, downloadDir) {
  const suggestedName = download.suggestedFilename();
  const targetPath = path.join(path.resolve(downloadDir ?? "storage/downloads"), suggestedName);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await download.saveAs(targetPath);

  const extension = path.extname(targetPath).toLowerCase();
  if (extension === ".docx") {
    return readDocxText(targetPath);
  }

  if (extension === ".txt" || extension === ".html" || extension === ".xml") {
    return fs.readFile(targetPath, "utf8");
  }

  throw new Error(`Downloaded ${suggestedName}, but I do not know how to read ${extension} yet.`);
}

export async function convertEquationToMathML(config, equationSource) {
  if (!config?.url) {
    throw new Error("mathConverter.url is not configured.");
  }

  return withPage(async (page) => {
    await page.goto(config.url, { waitUntil: "domcontentloaded" });
    await page.fill(config.inputSelector, equationSource);
    await page.click(config.convertSelector);
    await page.waitForFunction(
      ({ selector, expectedText }) => {
        const element = document.querySelector(selector);
        const text = element?.innerText ?? element?.textContent ?? "";
        return expectedText ? text.includes(expectedText) : text.trim().length > 0;
      },
      {
        selector: config.outputSelector,
        expectedText: config.waitForText
      },
      { timeout: 120000 }
    );
    return page.locator(config.outputSelector).innerText();
  });
}
