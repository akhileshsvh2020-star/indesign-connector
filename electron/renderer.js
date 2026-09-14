const statusBadge = document.querySelector("#statusBadge");
const workerId = document.querySelector("#workerId");
const apiBaseUrl = document.querySelector("#apiBaseUrl");
const envState = document.querySelector("#envState");
const logs = document.querySelector("#logs");
const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const openWebsiteButton = document.querySelector("#openWebsiteButton");
const openConfigButton = document.querySelector("#openConfigButton");
const openEnvButton = document.querySelector("#openEnvButton");
const updateButton = document.querySelector("#updateButton");
const clearButton = document.querySelector("#clearButton");

function appendLog(value) {
  logs.textContent += String(value);
  if (!String(value).endsWith("\n")) logs.textContent += "\n";
  logs.scrollTop = logs.scrollHeight;
}

function setStatus(status) {
  statusBadge.textContent = status === "running" ? "Running" : "Stopped";
  statusBadge.className = status === "running" ? "badge running" : "badge";
  startButton.disabled = status === "running";
  stopButton.disabled = status !== "running";
}

async function refreshState() {
  const state = await window.connector.getState();
  workerId.textContent = state.workerId || "Not set";
  apiBaseUrl.textContent = state.apiBaseUrl || "Not set";
  envState.textContent = state.hasEnv ? "Found" : "Missing .env";
  setStatus(state.running ? "running" : "stopped");
}

async function runAction(action) {
  try {
    await action();
    await refreshState();
  } catch (error) {
    appendLog(`ERROR: ${error.message || error}`);
    statusBadge.textContent = "Error";
    statusBadge.className = "badge error";
  }
}

startButton.addEventListener("click", () => runAction(() => window.connector.start()));
stopButton.addEventListener("click", () => runAction(() => window.connector.stop()));
openWebsiteButton.addEventListener("click", () => runAction(() => window.connector.openWebsite()));
openConfigButton.addEventListener("click", () => runAction(() => window.connector.openConfig()));
openEnvButton.addEventListener("click", () => runAction(() => window.connector.openEnv()));
updateButton.addEventListener("click", () => runAction(() => window.connector.updateCode()));
clearButton.addEventListener("click", () => { logs.textContent = ""; });

window.connector.onLog(appendLog);
window.connector.onStatus(setStatus);
refreshState();
