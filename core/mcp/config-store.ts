import type { MCPServerConfig, MCPClientJSONEntry, MCPClientsJSON, NewMCPServerConfig } from './types';

const STORAGE_KEY = 'dpp_mcp_servers';

export async function getAllMCPServers(): Promise<MCPServerConfig[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const servers = (result[STORAGE_KEY] as MCPServerConfig[]) || [];
  return servers.map(migrateServer);
}

function migrateServer(s: MCPServerConfig): MCPServerConfig {
  if (!s.transport) {
    s = { ...s, transport: s.url ? 'sse' : 'stdio' };
  }
  return s;
}

export async function getMCPServer(id: string): Promise<MCPServerConfig | null> {
  const servers = await getAllMCPServers();
  return servers.find((s) => s.id === id) ?? null;
}

export async function addMCPServer(config: NewMCPServerConfig): Promise<MCPServerConfig> {
  const servers = await getAllMCPServers();
  const now = Date.now();
  const id = generateId();
  const server: MCPServerConfig = { ...config, id, createdAt: now, updatedAt: now };
  servers.push(server);
  await chrome.storage.local.set({ [STORAGE_KEY]: servers });
  return server;
}

export async function updateMCPServer(id: string, patch: Partial<NewMCPServerConfig>): Promise<MCPServerConfig | null> {
  const servers = await getAllMCPServers();
  const idx = servers.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  servers[idx] = { ...servers[idx], ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEY]: servers });
  return servers[idx];
}

export async function deleteMCPServer(id: string): Promise<void> {
  const servers = await getAllMCPServers();
  const filtered = servers.filter((s) => s.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

export async function replaceAllMCPServers(servers: MCPServerConfig[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: servers });
}

export function exportMCPServersToJSON(servers: MCPServerConfig[]): MCPClientsJSON {
  const mcpServers: Record<string, MCPClientJSONEntry> = {};
  for (const s of servers) {
    if (s.transport === 'stdio') {
      mcpServers[s.name] = {
        command: s.command || '',
        args: s.args,
        env: s.env,
      };
    } else {
      mcpServers[s.name] = {
        type: s.transport,
        url: s.url || '',
        ...(s.authToken ? { headers: { Authorization: `Bearer ${s.authToken}` } } : {}),
      };
    }
  }
  return { mcpServers };
}

export function generateMCPServersJSON(servers: MCPServerConfig[]): string {
  return JSON.stringify(exportMCPServersToJSON(servers), null, 2);
}

export function parseMCPServersJSON(json: string): NewMCPServerConfig[] {
  let parsed: MCPClientsJSON;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('无效的 JSON 格式');
  }

  if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
    throw new Error('缺少 mcpServers 字段');
  }

  const configs: NewMCPServerConfig[] = [];

  for (const [name, entry] of Object.entries(parsed.mcpServers)) {
    const e = entry as MCPClientJSONEntry;

    if (e.command || e.args) {
      configs.push({
        name,
        transport: 'stdio',
        command: e.command || '',
        args: e.args,
        env: e.env,
        enabled: false,
      });
    } else if (e.url) {
      const transport = e.type === 'http' ? 'http' : 'sse';
      const authToken = e.headers?.['Authorization']?.replace(/^Bearer\s+/i, '') || undefined;
      configs.push({
        name,
        transport,
        url: e.url,
        authToken,
        enabled: true,
      });
    }
  }

  return configs;
}

export async function importMCPServersFromJSON(json: string): Promise<MCPServerConfig[]> {
  const parsed = parseMCPServersJSON(json);
  const now = Date.now();
  const servers: MCPServerConfig[] = parsed.map((c) => ({
    ...c,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }));
  // Merge: skip duplicates by name
  const existing = await getAllMCPServers();
  const newServers = servers.filter((s) => !existing.some((e) => e.name === s.name));
  const all = [...existing, ...newServers];
  await chrome.storage.local.set({ [STORAGE_KEY]: all });
  return newServers;
}

function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
