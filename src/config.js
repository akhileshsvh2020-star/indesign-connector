import fs from "node:fs";
import path from "node:path";

loadDotEnv();

const defaultConfig = {
  port: 3000,
  publicBaseUrl: "http://localhost:3000",
  sourceWebsite: null,
  mathConverter: null,
  indesign: {
    enabled: false,
    applicationProgId: "InDesign.Application",
    normalPointSize: 12,
    equationScale: 0.5
  },
  embeddedWorker: {
    enabled: false,
    workerId: "akhilesh"
  },
  storage: {
    provider: "memory",
    supabase: {
      urlEnv: "SUPABASE_URL",
      serviceRoleKeyEnv: "SUPABASE_SERVICE_ROLE_KEY",
      bucket: "indesign-jobs"
    }
  }
};

function loadDotEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function applyRuntimeOverrides(config) {
  if (!process.env.VERCEL) return config;

  return {
    ...config,
    publicBaseUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : config.publicBaseUrl,
    embeddedWorker: {
      ...(config.embeddedWorker ?? {}),
      enabled: false
    },
    storage: {
      ...(config.storage ?? {}),
      provider: "supabase",
      supabase: {
        ...defaultConfig.storage.supabase,
        ...(config.storage?.supabase ?? {})
      }
    }
  };
}

export function loadConfig() {
  const configPath = path.resolve("config.json");
  if (!fs.existsSync(configPath)) {
    return applyRuntimeOverrides(defaultConfig);
  }

  const userConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return applyRuntimeOverrides({
    ...defaultConfig,
    ...userConfig,
    indesign: {
      ...defaultConfig.indesign,
      ...(userConfig.indesign ?? {})
    },
    embeddedWorker: {
      ...defaultConfig.embeddedWorker,
      ...(userConfig.embeddedWorker ?? {})
    },
    storage: {
      ...defaultConfig.storage,
      ...(userConfig.storage ?? {}),
      supabase: {
        ...defaultConfig.storage.supabase,
        ...(userConfig.storage?.supabase ?? {})
      }
    }
  });
}
