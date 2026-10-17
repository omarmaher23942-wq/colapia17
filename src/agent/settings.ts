import "server-only";
import { getFlag } from "@/lib/flags";
import { env } from "@/lib/env";
import { AGENT_FLAG, agentConfigFrom, demoUrlFor, type AgentConfig } from "./config";

export async function agentConfig(): Promise<AgentConfig> {
  const f = await getFlag<Record<string, unknown>>(AGENT_FLAG).catch(() => ({ enabled: true, config: null }));
  return agentConfigFrom(f.config);
}

export async function demoUrl(): Promise<string> {
  const cfg = await agentConfig();
  return demoUrlFor(cfg, env.ROOT_DOMAIN);
}
