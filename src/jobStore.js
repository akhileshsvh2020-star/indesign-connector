import { randomUUID } from "node:crypto";

const jobs = new Map();
const queue = [];
const activeJobIds = new Set();

export function createJob(file, options = {}) {
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    status: "queued",
    assignedTo: options.assignedTo,
    originalName: file.originalname,
    uploadPath: file.path,
    createdAt: now,
    updatedAt: now,
    log: [`Job queued for ${options.assignedTo}.`],
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

export function nextQueuedJob(workerId) {
  const queueIndex = queue.findIndex((id) => {
    const job = jobs.get(id);
    return job?.status === "queued" && job?.assignedTo === workerId;
  });
  if (queueIndex === -1) return null;

  const [id] = queue.splice(queueIndex, 1);
  const job = jobs.get(id);
  if (!job) return null;

  activeJobIds.add(id);
  job.status = "running";
  job.updatedAt = new Date().toISOString();
  job.log.push(`Claimed by worker ${workerId}.`);
  return job;
}

export function finishActiveJob(id) {
  activeJobIds.delete(id);
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;

  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  if (job.status === "done" || job.status === "failed") {
    finishActiveJob(id);
  }
  return job;
}

export function appendLog(id, message) {
  const job = jobs.get(id);
  if (!job) return null;

  job.log.push(message);
  job.updatedAt = new Date().toISOString();
  return job;
}
