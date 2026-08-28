import { randomUUID } from "node:crypto";

const jobs = new Map();
const queue = [];
let activeJobId = null;

export function createJob(file) {
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    status: "queued",
    originalName: file.originalname,
    uploadPath: file.path,
    createdAt: now,
    updatedAt: now,
    log: ["Job queued."],
    result: null,
    error: null
  };

  jobs.set(job.id, job);
  queue.push(job.id);
  return job;
}

export function listJobs() {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id) {
  return jobs.get(id);
}

export function nextQueuedJob() {
  if (activeJobId) return null;
  const id = queue.shift();
  if (!id) return null;
  activeJobId = id;
  return jobs.get(id);
}

export function finishActiveJob(id) {
  if (activeJobId === id) {
    activeJobId = null;
  }
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;

  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  return job;
}

export function appendLog(id, message) {
  const job = jobs.get(id);
  if (!job) return null;

  job.log.push(message);
  job.updatedAt = new Date().toISOString();
  return job;
}
