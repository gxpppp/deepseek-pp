import { SSETransport } from './sse-transport';
import type { MCPServerConfig, MCPTool, MCPResource, MCPPrompt, MCPInitializeResult, MCPToolCallResult, MCPClientState } from './types';

export class MCPClient {
  private transport: SSETransport;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];
  private state: MCPClientState = 'disconnected';
  private errorMessage: string | undefined;
  private onStateChange: (() => void) | null = null;

  constructor(public readonly config: MCPServerConfig) {
    this.transport = new SSETransport((status, error) => {
      this.state = status;
      this.errorMessage = error;
      this.onStateChange?.();
    });

    this.transport.setDisconnectHandler(() => {
      if (this.state !== 'connecting') {
        this.state = 'disconnected';
        this.onStateChange?.();
      }
    });
  }

  async connect(): Promise<void> {
    if (!this.config.enabled) return;

    if (this.config.transport === 'stdio') {
      this.state = 'unavailable';
      this.errorMessage = 'stdio 传输需要本地代理，浏览器不能直接启动子进程';
      this.onStateChange?.();
      return;
    }

    const connectUrl = this.config.url;
    if (!connectUrl) {
      this.state = 'error';
      this.errorMessage = '未配置 URL';
      this.onStateChange?.();
      return;
    }

    await this.transport.connect(connectUrl, this.config.authToken);
    if (this.transport.isConnected()) {
      await this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    const result = await this.transport.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'deepseek-pp',
        version: '0.1.0',
      },
    }) as MCPInitializeResult;

    await this.transport.sendRequest('notifications/initialized', {});

    await this.discoverTools();
  }

  private async discoverTools(): Promise<void> {
    try {
      const result = await this.transport.sendRequest('tools/list', {}) as { tools: MCPTool[] };
      this.tools = result.tools || [];
    } catch {
      this.tools = [];
    }

    try {
      const result = await this.transport.sendRequest('resources/list', {}) as { resources: MCPResource[] };
      this.resources = result.resources || [];
    } catch {
      this.resources = [];
    }

    try {
      const result = await this.transport.sendRequest('prompts/list', {}) as { prompts: MCPPrompt[] };
      this.prompts = result.prompts || [];
    } catch {
      this.prompts = [];
    }

    this.onStateChange?.();
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    return this.transport.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    }) as Promise<MCPToolCallResult>;
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  getState(): MCPClientState {
    return this.state;
  }

  getError(): string | undefined {
    return this.errorMessage;
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.transport.isConnected();
  }

  setOnStateChange(callback: (() => void) | null): void {
    this.onStateChange = callback;
  }

  disconnect(): void {
    this.transport.disconnect();
    this.state = 'disconnected';
    this.tools = [];
    this.onStateChange?.();
  }
}
