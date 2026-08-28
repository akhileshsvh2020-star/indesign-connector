import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { processJob } from "./worker.js";

function loadWorkerConfig() {
  const configPath = path.resolve("worker.config.json");
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  const appConfig = loadConfig();
  return {
    workerId: appConfig.embeddedWorker?.workerId ?? "akhilesh",
    apiBaseUrl: appConfig.publicBaseUrl ?? `http://localhost:${appConfig.port ?? 3000}`,
    pollIntervalMs: 3000,
    sourceWebsite: appConfig.sourceWebsite,
    mathConverter: appConfig.mathConverter,
    indesign: appConfig.indesign
  };
}

async function api(baseUrl, pathName, options = {}) {
  const response = await fetch(new URL(pathName, baseUrl), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function downloadJobFile(baseUrl, job) {
  const response = await fetch(new URL(`/api/jobs/${job.id}/file`, baseUrl));
  if (!response.ok) {
    throw new Error(`Could not download job file: ${response.status}`);
  }

  const downloadDir = path.resolve("storage", "worker-downloads", job.id);
  await fsp.mkdir(downloadDir, { recursive: true });
  const targetPath = path.join(downloadDir, job.originalName);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(targetPath, bytes);
  return targetPath;
}

async function runOnce(config) {
  const claimed = await api(config.apiBaseUrl, `/api/workers/${config.workerId}/claim`, {
    method: "POST",
    body: "{}"
  });

  if (!claimed.job) return false;

  const remoteJob = claimed.job;
  const uploadPath = await downloadJobFile(config.apiBaseUrl, remoteJob);
  const job = { ...remoteJob, uploadPath };

  await processJob(job, config, {
    log: (message) => api(config.apiBaseUrl, `/api/jobs/${job.id}/log`, {
      method: "POST",
      body: JSON.stringify({ message })
    }),
    update: (patch) => api(config.apiBaseUrl, `/api/jobs/${job.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    })
  });

  return true;
}

async function main() {
  const config = loadWorkerConfig();
  console.log(`Local InDesign worker started for ${config.workerId}.`);
  console.log(`Polling ${config.apiBaseUrl}.`);

  for (;;) {
    try {
      await runOnce(config);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs ?? 3000));
  }
}

main();
