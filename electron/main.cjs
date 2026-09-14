const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow;
let workerProcess;
let setupProcess;

const projectRoot = path.resolve(__dirname, "..");
const workerConfigPath = path.join(projectRoot, "worker.config.json");
const workerConfigExamplePath = path.join(projectRoot, "worker.config.example.json");
const envPath = path.join(projectRoot, ".env");

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: "InDesign Connector",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
}

function send(channel, payload) {
  mainWindow?.webContents.send(channel, payload);
}

function appendLog(message) {
  send("connector:log", String(message));
}

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function ensureWorkerConfig() {
  if (!fs.existsSync(workerConfigPath) && fs.existsSync(workerConfigExamplePath)) {
    fs.copyFileSync(workerConfigExamplePath, workerConfigPath);
  }
}

function readWorkerConfig() {
  ensureWorkerConfig();
  if (!fs.existsSync(workerConfigPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(workerConfigPath, "utf8"));
  } catch {
    return null;
  }
}

function runStep(command, args) {
  return new Promise((resolve, reject) => {
    appendLog(`> ${command} ${args.join(" ")}`);
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: false,
      windowsHide: true,
      env: process.env,
    });

    setupProcess = child;
    child.stdout.on("data", (data) => appendLog(data));
    child.stderr.on("data", (data) => appendLog(data));
    child.on("error", reject);
    child.on("exit", (code) => {
      setupProcess = null;
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function ensureSetup() {
  if (!fs.existsSync(path.join(projectRoot, "node_modules"))) {
    appendLog("Node packages are missing. Installing now...");
    await runStep(commandName("npm"), ["install"]);
  }

  appendLog("Checking Playwright Chromium...");
  await runStep(commandName("npx"), ["playwright", "install", "chromium"]);
}

function startWorker() {
  if (workerProcess) return;

  workerProcess = spawn(commandName("npm"), ["run", "worker"], {
    cwd: projectRoot,
    shell: false,
    windowsHide: true,
    env: process.env,
  });

  send("connector:status", "running");
  appendLog("Worker started. Keep this connector app open.");
  workerProcess.stdout.on("data", (data) => appendLog(data));
  workerProcess.stderr.on("data", (data) => appendLog(data));
  workerProcess.on("exit", (code) => {
    appendLog(`Worker stopped${code === null ? "." : ` with code ${code}.`}`);
    workerProcess = null;
    send("connector:status", "stopped");
  });
}

ipcMain.handle("connector:getState", () => {
  const config = readWorkerConfig();
  return {
    running: Boolean(workerProcess),
    projectRoot,
    hasEnv: fs.existsSync(envPath),
    hasWorkerConfig: fs.existsSync(workerConfigPath),
    apiBaseUrl: config?.apiBaseUrl ?? "",
    workerId: config?.workerId ?? "",
  };
});

ipcMain.handle("connector:start", async () => {
  ensureWorkerConfig();
  if (!fs.existsSync(envPath)) {
    throw new Error(".env file is missing. Open Credentials and add the required details first.");
  }

  await ensureSetup();
  startWorker();
});

ipcMain.handle("connector:stop", () => {
  if (setupProcess) {
    setupProcess.kill();
    setupProcess = null;
  }
  if (workerProcess) {
    workerProcess.kill();
    workerProcess = null;
  }
  send("connector:status", "stopped");
});

ipcMain.handle("connector:openConfig", async () => {
  ensureWorkerConfig();
  await shell.openPath(workerConfigPath);
});

ipcMain.handle("connector:openEnv", async () => {
  if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, "");
  await shell.openPath(envPath);
});

ipcMain.handle("connector:openWebsite", async () => {
  const config = readWorkerConfig();
  const url = config?.apiBaseUrl || "http://indesign.extractorpro.in:10039";
  await shell.openExternal(url);
});

ipcMain.handle("connector:updateCode", async () => {
  await runStep("git", ["pull"]);
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (workerProcess) workerProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
