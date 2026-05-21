import type { MCPToolCallPayload, MCPToolCallResult } from './types';
import type { ToolCardResult } from '../types';
import { MCPClient } from './mcp-client';

const clients = new Map<string, MCPClient>();

export function registerMCPClient(client: MCPClient): void {
  clients.set(client.config.id, client);
}

export function unregisterMCPClient(serverId: string): void {
  const client = clients.get(serverId);
  if (client) {
    client.disconnect();
    clients.delete(serverId);
  }
}

export function getMCPClient(serverId: string): MCPClient | undefined {
  return clients.get(serverId);
}

export function getAllMCPClients(): MCPClient[] {
  return Array.from(clients.values());
}

export function getAllConnectedMCPServers(): Array<{ serverId: string; serverName: string; tools: import('./types').MCPTool[] }> {
  return Array.from(clients.values())
    .filter((c) => c.isConnected())
    .map((c) => ({
      serverId: c.config.id,
      serverName: c.config.name,
      tools: c.getTools(),
    }));
}

export function removeAllMCPServers(): void {
  for (const [id, client] of clients) {
    client.disconnect();
    clients.delete(id);
  }
}

export async function executeMCPToolCall(payload: MCPToolCallPayload): Promise<ToolCardResult> {
  const client = clients.get(payload.server);
  if (!client) {
    return {
      ok: false,
      summary: `MCP Server "${payload.server}" 未连接`,
      detail: `找不到 ID 为 "${payload.server}" 的 MCP 服务器`,
    };
  }

  if (!client.isConnected()) {
    return {
      ok: false,
      summary: `MCP Server "${payload.server}" 已断开`,
      detail: '服务器连接已断开，请检查网络或重新连接',
    };
  }

  try {
    const result: MCPToolCallResult = await client.callTool(payload.tool, payload.arguments);

    if (result.isError) {
      const errorText = result.content.map((c) => c.text || '').join('\n');
      return {
        ok: false,
        summary: `MCP 工具 ${payload.tool} 执行出错`,
        detail: errorText || '未知错误',
      };
    }

    const textContent = result.content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n');

    return {
      ok: true,
      summary: `mcp ${payload.tool} 已执行`,
      detail: textContent || '执行成功，无文本返回',
    };
  } catch (err) {
    return {
      ok: false,
      summary: `MCP 工具 ${payload.tool} 执行失败`,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
