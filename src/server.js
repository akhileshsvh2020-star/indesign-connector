import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { appendLog, createJob, getJob, listJobs, nextQueuedJob, updateJob } from "./jobStore.js";
import { startWorker } from "./worker.js";

const config = loadConfig();
const app = express();
const uploadDir = path.resolve("storage", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.resolve("storage", "outputs"), { recursive: true });

const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(express.static(path.resolve("public")));

app.get("/api/config", (_request, response) => {
  response.json({ workers: config.workers ?? [] });
});

app.get("/api/jobs", (_request, response) => {
  response.json({ jobs: listJobs() });
});

app.get("/api/jobs/:id", (request, response) => {
  const job = getJob(request.params.id);
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.json({ job });
});

app.get("/api/jobs/:id/file", (request, response) => {
  const job = getJob(request.params.id);
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.download(path.resolve(job.uploadPath), job.originalName);
});

app.post("/api/jobs", upload.single("file"), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "Upload a file first." });
    return;
  }

  const assignedTo = request.body.assignedTo;
  const validWorker = (config.workers ?? []).some((worker) => worker.id === assignedTo);
  if (!validWorker) {
    response.status(400).json({ error: "Choose a valid user for this job." });
    return;
  }

  const job = createJob(request.file, { assignedTo });
  response.status(201).json({ job });
});

app.post("/api/workers/:workerId/claim", (request, response) => {
  const job = nextQueuedJob(request.params.workerId);
  response.json({ job: job ?? null });
});

app.post("/api/jobs/:id/log", (request, response) => {
  const { message } = request.body ?? {};
  if (!message) {
    response.status(400).json({ error: "message is required." });
    return;
  }

  const job = appendLog(request.params.id, message);
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.json({ job });
});

app.patch("/api/jobs/:id", (request, response) => {
  const job = updateJob(request.params.id, request.body ?? {});
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.json({ job });
});

if (config.embeddedWorker?.enabled) {
  startWorker(config, config.embeddedWorker.workerId);
}

app.listen(config.port, "0.0.0.0", () => {
  console.log(`InDesign Connector running at http://localhost:${config.port}`);
});
