import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import os from "node:os";
import { readDocxText } from "../fileReaders.js";

function findInstalledChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function getConnectorProfileDir() {
  return path.join(os.homedir(), "AppData", "Local", "InDesignConnector", "ChromeProfile");
}

async function withPage(task, options = {}) {
  const installedChrome = findInstalledChrome();
  const useInstalledChrome = process.env.USE_INSTALLED_CHROME !== "false" && installedChrome;

  if (useInstalledChrome) {
    const context = await chromium.launchPersistentContext(getConnectorProfileDir(), {
      executablePath: installedChrome,
      headless: false,
      acceptDownloads: true,
      viewport: { width: 1366, height: 768 },
      ...(options.downloadsPath ? { downloadsPath: options.downloadsPath } : {})
    });
    const page = await context.newPage();
    try {
      return await task(page);
    } finally {
      await context.close();
    }
  }

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
  const convertCard = page.locator("button.category-card.iris");
  const alreadyLoggedIn = await convertCard.waitFor({ state: "visible", timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (alreadyLoggedIn) return;

  const email = authConfig?.emailEnv ? process.env[authConfig.emailEnv] : "";
  const password = authConfig?.passwordEnv ? process.env[authConfig.passwordEnv] : "";

  if (email && password) {
    await page.locator("button.profile-trigger").click();
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /^Login$/i }).last().click();

    const loginCompleted = await convertCard.waitFor({ state: "visible", timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (loginCompleted) return;
  }

  console.log("ExtractorPro is not logged in. Login manually in the Chrome window now; waiting up to 5 minutes...");
  const manuallyLoggedIn = await convertCard.waitFor({ state: "visible", timeout: 300000 })
    .then(() => true)
    .catch(() => false);

  if (!manuallyLoggedIn) {
    await saveDebugScreenshot(page, downloadDir, "extractorpro-login-failed.png");
    const visibleText = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
    throw new Error(`ExtractorPro login did not reach the main Convert page after waiting for manual login. Visible page text: ${visibleText}`);
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
