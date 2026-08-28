import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const jobs = new Map();
const queue = [];

function clone(job) {
  return job ? JSON.parse(JSON.stringify(job)) : null;
}

export function createMemoryStore() {
  return {
    async createJob(file, options = {}) {
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
      return clone(job);
    },

    async listJobs() {
      return Array.from(jobs.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    async getJob(id) {
      return clone(jobs.get(id));
    },

    async claimJob(workerId) {
      const queueIndex = queue.findIndex((id) => {
        const job = jobs.get(id);
        return job?.status === "queued" && job?.assignedTo === workerId;
      });
      if (queueIndex === -1) return null;

      const [id] = queue.splice(queueIndex, 1);
      const job = jobs.get(id);
      if (!job) return null;

      job.status = "running";
      job.updatedAt = new Date().toISOString();
      job.log.push(`Claimed by worker ${workerId}.`);
      return clone(job);
    },

    async updateJob(id, patch) {
      const job = jobs.get(id);
      if (!job) return null;
      Object.assign(job, patch, { updatedAt: new Date().toISOString() });
      return clone(job);
    },

    async appendLog(id, message) {
      const job = jobs.get(id);
      if (!job) return null;
      job.log.push(message);
      job.updatedAt = new Date().toISOString();
      return clone(job);
    },

    async getUploadedFile(job) {
      return {
        stream: fs.createReadStream(path.resolve(job.uploadPath)),
        filename: job.originalName
      };
    }
  };
}
