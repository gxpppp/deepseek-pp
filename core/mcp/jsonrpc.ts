import type { JSONRPCRequest, JSONRPCNotification, JSONRPCResponse } from './types';

let _nextId = 1;

export function nextRequestId(): number {
  return _nextId++;
}

export function createRequest(method: string, params?: Record<string, unknown>): JSONRPCRequest {
  return {
    jsonrpc: '2.0',
    id: nextRequestId(),
    method,
    params,
  };
}

export function createNotification(method: string, params?: Record<string, unknown>): JSONRPCNotification {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

export function createErrorResponse(id: number | string, code: number, message: string): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  };
}

export function isResponse(msg: unknown): msg is JSONRPCResponse {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as JSONRPCResponse).jsonrpc === '2.0' &&
    typeof (msg as JSONRPCResponse).id !== 'undefined' &&
    ('result' in msg || 'error' in msg)
  );
}
