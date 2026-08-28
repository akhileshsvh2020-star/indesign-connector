import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createStore } from "./stores/createStore.js";

const config = loadConfig();
const store = createStore(config);
const app = express();
const isVercel = Boolean(process.env.VERCEL);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadDir = isVercel ? path.join("/tmp", "indesign-uploads") : path.resolve("storage", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });
if (!isVercel) {
  fs.mkdirSync(path.resolve("storage", "outputs"), { recursive: true });
}

const upload = multer({ dest: uploadDir });

app.use(express.json());
app.use(express.static(path.join(projectRoot, "public")));

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

app.get("/api/config", (_request, response) => {
  response.json({ workers: config.workers ?? [] });
});

app.get("/api/jobs", asyncRoute(async (_request, response) => {
  response.json({ jobs: await store.listJobs() });
}));

app.get("/api/jobs/:id", asyncRoute(async (request, response) => {
  const job = await store.getJob(request.params.id);
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.json({ job });
}));

app.get("/api/jobs/:id/file", asyncRoute(async (request, response) => {
  const job = await store.getJob(request.params.id);
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  const file = await store.getUploadedFile(job);
  response.setHeader("content-disposition", `attachment; filename="${encodeURIComponent(file.filename)}"`);
  if (file.buffer) {
    response.send(file.buffer);
    return;
  }

  file.stream.pipe(response);
}));

app.post("/api/jobs", upload.single("file"), asyncRoute(async (request, response) => {
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

  const job = await store.createJob(request.file, { assignedTo });
  response.status(201).json({ job });
}));

app.post("/api/workers/:workerId/claim", asyncRoute(async (request, response) => {
  const job = await store.claimJob(request.params.workerId);
  response.json({ job: job ?? null });
}));

app.post("/api/jobs/:id/log", asyncRoute(async (request, response) => {
  const { message } = request.body ?? {};
  if (!message) {
    response.status(400).json({ error: "message is required." });
    return;
  }

  const job = await store.appendLog(request.params.id, message);
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.json({ job });
}));

app.patch("/api/jobs/:id", asyncRoute(async (request, response) => {
  const job = await store.updateJob(request.params.id, request.body ?? {});
  if (!job) {
    response.status(404).json({ error: "Job not found." });
    return;
  }

  response.json({ job });
}));

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

if (!isVercel && config.embeddedWorker?.enabled) {
  const { startWorker } = await import("./worker.js");
  startWorker(config, config.embeddedWorker.workerId, store);
}

if (!isVercel) {
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`InDesign Connector running at http://localhost:${config.port}`);
  });
}

export default app;
