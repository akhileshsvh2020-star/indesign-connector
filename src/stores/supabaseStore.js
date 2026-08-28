import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function toJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    assignedTo: row.assigned_to,
    originalName: row.original_name,
    uploadPath: row.upload_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    log: row.log ?? [],
    result: row.result,
    error: row.error
  };
}

function toPatch(patch) {
  const row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo;
  if (patch.originalName !== undefined) row.original_name = patch.originalName;
  if (patch.uploadPath !== undefined) row.upload_path = patch.uploadPath;
  if (patch.log !== undefined) row.log = patch.log;
  if (patch.result !== undefined) row.result = patch.result;
  if (patch.error !== undefined) row.error = patch.error;
  row.updated_at = new Date().toISOString();
  return row;
}

export function createSupabaseStore(config) {
  const supabaseConfig = config.storage?.supabase ?? {};
  const url = process.env[supabaseConfig.urlEnv ?? "SUPABASE_URL"];
  const serviceRoleKey = process.env[supabaseConfig.serviceRoleKeyEnv ?? "SUPABASE_SERVICE_ROLE_KEY"];
  const bucket = supabaseConfig.bucket ?? "indesign-jobs";

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase storage selected, but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false }
  });

  return {
    async createJob(file, options = {}) {
      const id = randomUUID();
      const uploadPath = `uploads/${id}/${file.originalname}`;
      const fileBytes = await fs.readFile(file.path);

      const upload = await supabase.storage.from(bucket).upload(uploadPath, fileBytes, {
        contentType: file.mimetype || "application/octet-stream",
        upsert: false
      });
      if (upload.error) throw upload.error;

      const row = {
        id,
        status: "queued",
        assigned_to: options.assignedTo,
        original_name: file.originalname,
        upload_path: uploadPath,
        log: [`Job queued for ${options.assignedTo}.`],
        result: null,
        error: null
      };

      const created = await supabase.from("jobs").insert(row).select("*").single();
      if (created.error) throw created.error;
      return toJob(created.data);
    },

    async listJobs() {
      const result = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
      if (result.error) throw result.error;
      return result.data.map(toJob);
    },

    async getJob(id) {
      const result = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (result.error) throw result.error;
      return toJob(result.data);
    },

    async claimJob(workerId) {
      const claimed = await supabase.rpc("claim_next_job", { worker_id_param: workerId });
      if (!claimed.error && claimed.data?.length) return toJob(claimed.data[0]);
      if (claimed.error && !String(claimed.error.message).includes("claim_next_job")) throw claimed.error;

      const result = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "queued")
        .eq("assigned_to", workerId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return null;

      const log = [...(result.data.log ?? []), `Claimed by worker ${workerId}.`];
      const updated = await supabase
        .from("jobs")
        .update({ status: "running", log, updated_at: new Date().toISOString() })
        .eq("id", result.data.id)
        .eq("status", "queued")
        .select("*")
        .maybeSingle();
      if (updated.error) throw updated.error;
      return toJob(updated.data);
    },

    async updateJob(id, patch) {
      const result = await supabase.from("jobs").update(toPatch(patch)).eq("id", id).select("*").maybeSingle();
      if (result.error) throw result.error;
      return toJob(result.data);
    },

    async appendLog(id, message) {
      const current = await this.getJob(id);
      if (!current) return null;
      return this.updateJob(id, { log: [...current.log, message] });
    },

    async getUploadedFile(job) {
      const result = await supabase.storage.from(bucket).download(job.uploadPath);
      if (result.error) throw result.error;
      const buffer = Buffer.from(await result.data.arrayBuffer());
      return { buffer, filename: job.originalName };
    }
  };
}
