import type { MCPTool } from './types';

export function convertMCPToolToPromptDescription(serverName: string, tool: MCPTool): string {
  const lines: string[] = [];
  lines.push(`- mcp: ${tool.name}（来自 ${serverName}）`);
  if (tool.description) {
    lines.push(`  ${tool.description}`);
  }
  if (tool.inputSchema?.properties) {
    const props = Object.entries(tool.inputSchema.properties).map(([key, schema]) => {
      const desc = (schema as Record<string, unknown>).description || '';
      const required = tool.inputSchema.required?.includes(key) ? '必填' : '可选';
      return `    ${key}: ${desc}（${required}）`;
    });
    if (props.length > 0) {
      lines.push('  参数:');
      lines.push(...props);
    }
  }
  return lines.join('\n');
}

export function buildMCPToolsPromptText(serverName: string, tools: MCPTool[]): string {
  if (tools.length === 0) return '';

  const header = `\n### MCP 工具（来自 ${serverName}）\n`;
  const descriptions = tools.map((t) => convertMCPToolToPromptDescription(serverName, t)).join('\n\n');

  return header + descriptions;
}

export function generateMCPSystemPromptSection(
  mcpTools: Array<{ serverId: string; serverName: string; tools: MCPTool[] }>,
): string {
  if (mcpTools.length === 0 || mcpTools.every((s) => s.tools.length === 0)) {
    return '';
  }

  const sections = mcpTools
    .filter((s) => s.tools.length > 0)
    .map((s) => buildMCPToolsPromptText(s.serverName, s.tools));

  if (sections.length === 0) return '';

  return '\n## MCP 外部工具\n\n你可以通过以下 MCP 工具访问外部服务。调用方式与其他工具相同：\n\n' +
    `<mcp>\n{"server": "服务器名称", "tool": "工具名", "arguments": {"参数名": "值"}}\n</mcp>\n\n` +
    sections.join('\n');
}
