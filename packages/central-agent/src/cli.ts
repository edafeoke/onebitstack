#!/usr/bin/env npx tsx
import { AgentClient } from "./client.js";
import { configPath, loadConfig, saveConfig } from "./config.js";
import { runAgentLoop } from "./runner.js";

const AGENT_VERSION = "0.1.0";

function usage(): void {
  console.log(`central-agent v${AGENT_VERSION}

Usage:
  central-agent pair --url <API_BASE> --token <PAIRING_TOKEN>
  central-agent run [--url <API_BASE>]

Config: ${configPath()}
`);
}

async function cmdPair(args: string[]): Promise<void> {
  let url = "";
  let token = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) url = args[++i];
    if (args[i] === "--token" && args[i + 1]) token = args[++i];
  }
  if (!url || !token) {
    console.error("pair requires --url and --token");
    process.exit(1);
  }
  const client = new AgentClient({ apiBaseUrl: url, accessToken: "" });
  const config = await client.pair(token, AGENT_VERSION);
  saveConfig(config);
  console.log(`Paired server ${config.serverId} (agent ${config.agentId})`);
  console.log(`Config saved to ${configPath()}`);
}

async function cmdRun(args: string[]): Promise<void> {
  let urlOverride = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url" && args[i + 1]) urlOverride = args[++i];
  }
  const config = loadConfig();
  if (!config && !urlOverride) {
    console.error("Not paired. Run: central-agent pair --url … --token …");
    process.exit(1);
  }
  const apiBaseUrl = urlOverride || config!.apiBaseUrl;
  const accessToken = config?.accessToken;
  if (!accessToken) {
    console.error("Missing access token in config. Pair again.");
    process.exit(1);
  }
  const client = new AgentClient({ ...config!, apiBaseUrl, accessToken });
  await runAgentLoop(client);
}

const [, , command, ...rest] = process.argv;

if (command === "pair") {
  await cmdPair(rest);
} else if (command === "run") {
  await cmdRun(rest);
} else {
  usage();
  process.exit(command ? 1 : 0);
}
