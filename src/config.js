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

export function loadConfig() {
  const configPath = path.resolve("config.json");
  if (!fs.existsSync(configPath)) {
    return defaultConfig;
  }

  const userConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return {
    ...defaultConfig,
    ...userConfig,
    indesign: {
      ...defaultConfig.indesign,
      ...(userConfig.indesign ?? {})
    }
  };
}
