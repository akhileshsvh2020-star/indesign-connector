import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { createJob, getJob, listJobs } from "./jobStore.js";
import { startWorker } from "./worker.js";

const config = loadConfig();
const app = express();
const uploadDir = path.resolve("storage", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.resolve("storage", "outputs"), { recursive: true });

const upload = multer({ dest: uploadDir });

app.use(express.static(path.resolve("public")));

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

app.post("/api/jobs", upload.single("file"), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "Upload a file first." });
    return;
  }

  const job = createJob(request.file);
  response.status(201).json({ job });
});

startWorker(config);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`InDesign Connector running at http://localhost:${config.port}`);
});
