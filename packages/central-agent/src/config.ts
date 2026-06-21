import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type AgentConfig = {
  apiBaseUrl: string;
  accessToken: string;
  serverId?: string;
  agentId?: string;
};

const CONFIG_DIR = join(homedir(), ".config", "central-agent");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function loadConfig(): AgentConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as AgentConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: AgentConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function configPath(): string {
  return CONFIG_PATH;
}
