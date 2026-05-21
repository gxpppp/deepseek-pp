export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

export function isJSONRPCResponse(msg: unknown): msg is JSONRPCResponse {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as JSONRPCResponse).jsonrpc === '2.0' &&
    'id' in msg &&
    ('result' in msg || 'error' in msg)
  );
}

export function isJSONRPCNotification(msg: unknown): msg is JSONRPCNotification {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as JSONRPCNotification).jsonrpc === '2.0' &&
    'method' in msg &&
    !('id' in msg)
  );
}

export type MCPTransport = 'sse' | 'http' | 'stdio';

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransport;
  url?: string;
  authToken?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export type NewMCPServerConfig = Omit<MCPServerConfig, 'id' | 'createdAt' | 'updatedAt'>;

export interface MCPClientsJSON {
  mcpServers: Record<string, MCPClientJSONEntry>;
}

export interface MCPClientJSONEntry {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'sse' | 'http';
  url?: string;
  headers?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo?: {
    name: string;
    version: string;
  };
}

export interface MCPToolCallPayload {
  server: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export type MCPClientState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'unavailable';

export interface MCPClientStatus {
  serverId: string;
  state: MCPClientState;
  tools: MCPTool[];
  error?: string;
}

export interface MCPToolDescriptor {
  serverId: string;
  serverName: string;
  tools: MCPTool[];
}

export interface MCPPromptText {
  text: string;
}
