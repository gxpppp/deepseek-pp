import type { JSONRPCResponse, JSONRPCNotification } from './types';
import { isResponse, createRequest } from './jsonrpc';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS = 30_000;

export class SSETransport {
  private abortController: AbortController | null = null;
  private pending = new Map<number | string, PendingRequest>();
  private onNotification: ((notification: JSONRPCNotification) => void) | null = null;
  private onDisconnect: (() => void) | null = null;
  private messageUrl: string | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sseUrl: string = '';
  private authToken: string | undefined;

  constructor(
    private onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error', error?: string) => void,
  ) {}

  async connect(sseUrl: string, authToken?: string): Promise<void> {
    this.sseUrl = sseUrl;
    this.authToken = authToken;
    this.onStatusChange('connecting');
    await this.establishConnection();
  }

  private async establishConnection(): Promise<void> {
    this.abortController = new AbortController();

    try {
      const headers: Record<string, string> = {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(this.sseUrl, {
        headers,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('SSE response has no body');
      }

      this.connected = true;
      this.onStatusChange('connected');
      await this.readSSEStream(response.body);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : String(err);
      this.onStatusChange('error', message);
      this.scheduleReconnect();
    }
  }

  private async readSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            eventData += line.slice(5);
          } else if (line === '') {
            if (eventData) {
              this.handleSSEEvent(eventType, eventData.trim());
            }
            eventType = '';
            eventData = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    this.connected = false;
    this.onStatusChange('disconnected');
    this.onDisconnect?.();
    this.scheduleReconnect();
  }

  private handleSSEEvent(eventType: string, data: string): void {
    if (eventType === 'endpoint') {
      this.messageUrl = data;
      return;
    }

    if (eventType === 'message' || !eventType) {
      try {
        const msg = JSON.parse(data);
        if (isResponse(msg)) {
          this.handleResponse(msg);
        } else if (msg.method && !msg.id) {
          this.onNotification?.(msg);
        }
      } catch {
        // Ignore non-JSON events
      }
    }
  }

  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;

    this.pending.delete(response.id);
    clearTimeout(pending.timeout);

    if (response.error) {
      pending.reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }

  async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.messageUrl) {
      throw new Error('MCP endpoint not received yet');
    }

    const request = createRequest(method, params);

    return new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(request.id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(request.id, { resolve, reject, timeout });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      fetch(this.messageUrl!, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      }).catch((err) => {
        const pending = this.pending.get(request.id);
        if (pending) {
          this.pending.delete(request.id);
          clearTimeout(pending.timeout);
          reject(err);
        }
      });
    });
  }

  setNotificationHandler(handler: ((notification: JSONRPCNotification) => void) | null): void {
    this.onNotification = handler;
  }

  setDisconnectHandler(handler: (() => void) | null): void {
    this.onDisconnect = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.connected && !this.abortController?.signal.aborted) {
        this.establishConnection();
      }
    }, 5000);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abortController?.abort();
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pending.clear();
    this.connected = false;
    this.messageUrl = null;
  }
}
