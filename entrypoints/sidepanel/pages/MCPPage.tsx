import { useEffect, useRef, useState } from 'react';
import type { MCPServerConfig, MCPTransport, NewMCPServerConfig } from '../../../core/mcp/types';
import { importMCPServersFromJSON, generateMCPServersJSON } from '../../../core/mcp/config-store';

interface ServerWithStatus {
  config: MCPServerConfig;
  status: string;
}

const TRANSPORT_LABELS: Record<MCPTransport, string> = {
  sse: 'SSE',
  http: 'HTTP',
  stdio: 'stdio',
};

const EMPTY_FORM = {
  name: '',
  transport: 'sse' as MCPTransport,
  url: '',
  authToken: '',
  command: '',
  args: '',
  enabled: true,
};

export default function MCPPage() {
  const [servers, setServers] = useState<ServerWithStatus[]>([]);
  const [editing, setEditing] = useState<{ id?: string; data: typeof EMPTY_FORM } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadServers = async () => {
    const configs: MCPServerConfig[] = await chrome.runtime.sendMessage({ type: 'GET_MCP_SERVERS' });
    const enriched: ServerWithStatus[] = (configs || []).map((c) => ({
      config: c,
      status: c.transport === 'stdio' ? '需要本地代理' : '未连接',
    }));
    setServers(enriched);
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleAdd = () => {
    setEditing({ data: { ...EMPTY_FORM } });
    setShowForm(true);
  };

  const handleEdit = (config: MCPServerConfig) => {
    setEditing({
      id: config.id,
      data: {
        name: config.name,
        transport: config.transport,
        url: config.url ?? '',
        authToken: config.authToken ?? '',
        command: config.command ?? '',
        args: (config.args ?? []).join(' '),
        enabled: config.enabled,
      },
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await chrome.runtime.sendMessage({ type: 'DELETE_MCP_SERVER', payload: { id } });
    loadServers();
  };

  const buildServerData = (): NewMCPServerConfig | null => {
    if (!editing) return null;
    const d = editing.data;
    if (!d.name.trim()) return null;

    if (d.transport === 'stdio') {
      if (!d.command.trim()) return null;
      return {
        name: d.name.trim(),
        transport: 'stdio',
        command: d.command.trim(),
        args: d.args.trim() ? d.args.trim().split(/\s+/) : [],
        enabled: d.enabled,
      };
    }

    if (!d.url.trim()) return null;
    return {
      name: d.name.trim(),
      transport: d.transport,
      url: d.url.trim(),
      authToken: d.authToken.trim() || undefined,
      enabled: d.enabled,
    };
  };

  const handleSave = async () => {
    if (!editing) return;
    const data = buildServerData();
    if (!data) return;

    if (editing.id) {
      await chrome.runtime.sendMessage({ type: 'UPDATE_MCP_SERVER', payload: { id: editing.id, patch: data } });
    } else {
      await chrome.runtime.sendMessage({ type: 'ADD_MCP_SERVER', payload: data });
    }
    setShowForm(false);
    setEditing(null);
    loadServers();
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importMCPServersFromJSON(text);
      setImportMsg(`成功导入 ${imported.length} 个服务器`);
      loadServers();
    } catch (err) {
      setImportMsg(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setImportMsg(null), 4000);
  };

  const handleExport = async () => {
    const all: MCPServerConfig[] = await chrome.runtime.sendMessage({ type: 'GET_MCP_SERVERS' });
    if (!all || all.length === 0) {
      setImportMsg('没有可导出的配置');
      setTimeout(() => setImportMsg(null), 3000);
      return;
    }
    const json = generateMCPServersJSON(all);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp-servers.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReconnect = async (server: MCPServerConfig) => {
    setServers((prev) =>
      prev.map((s) => (s.config.id === server.id ? { ...s, status: '连接中...' } : s)),
    );
    await chrome.runtime.sendMessage({ type: 'UPDATE_MCP_SERVER', payload: { id: server.id, patch: {} } });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ds-text)' }}>
          MCP 服务器
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleImport}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors"
            style={{ color: 'var(--ds-text-secondary)', background: 'var(--ds-surface)' }}
          >
            导入
          </button>
          <button
            onClick={handleExport}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors"
            style={{ color: 'var(--ds-text-secondary)', background: 'var(--ds-surface)' }}
          >
            导出
          </button>
          <button
            onClick={handleAdd}
            className="text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors"
            style={{ color: 'var(--ds-blue)', background: 'var(--ds-surface)' }}
          >
            + 添加
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />

      <p className="px-4 pb-1 text-[11px]" style={{ color: 'var(--ds-text-tertiary)' }}>
        支持 Claude Desktop / Cursor / VS Code 标准的 mcpServers JSON 格式
      </p>
      {importMsg && (
        <p
          className="px-4 pb-1 text-[11px] font-medium"
          style={{ color: importMsg.includes('失败') ? '#ef4444' : '#22c55e' }}
        >
          {importMsg}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {servers.length === 0 && !showForm && (
          <div className="text-center py-8 text-[12px]" style={{ color: 'var(--ds-text-tertiary)' }}>
            暂无 MCP 服务器
          </div>
        )}

        {servers.map((s) => (
          <div
            key={s.config.id}
            className="rounded-lg p-3"
            style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: s.status === '已连接' || s.status === 'connected'
                      ? '#22c55e'
                      : s.status === '连接中...' || s.status === 'connecting'
                        ? '#f59e0b'
                        : s.config.transport === 'stdio' ? '#a855f7' : '#6b7280',
                  }}
                />
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate" style={{ color: 'var(--ds-text)' }}>
                    {s.config.name}
                  </div>
                  <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--ds-text-tertiary)' }}>
                    {s.config.transport === 'stdio'
                      ? `${s.config.command} ${(s.config.args ?? []).join(' ')}`
                      : s.config.url}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                  style={{
                    color: s.config.transport === 'stdio' ? '#a855f7' : 'var(--ds-blue)',
                    background: s.config.transport === 'stdio'
                      ? 'rgba(168,85,247,0.1)'
                      : 'rgba(59,130,246,0.1)',
                  }}
                >
                  {TRANSPORT_LABELS[s.config.transport]}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: s.status === '已连接' ? '#22c55e' : 'var(--ds-text-tertiary)' }}
                >
                  {s.status === '已连接' || s.status === 'connected'
                    ? '已连接'
                    : s.status}
                </span>
              </div>
            </div>

            {s.config.transport === 'stdio' && (
              <div
                className="mt-2 p-2 rounded text-[10px]"
                style={{ color: '#a855f7', background: 'rgba(168,85,247,0.08)' }}
              >
                此服务器使用 stdio 传输，浏览器无法直接连接。需要配合本地 MCP 代理工具桥接。
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--ds-border)' }}>
              <button
                onClick={() => handleEdit(s.config)}
                className="text-[10px] px-2 py-0.5 rounded transition-colors"
                style={{ color: 'var(--ds-blue)' }}
              >
                编辑
              </button>
              {s.config.transport !== 'stdio' && (
                <button
                  onClick={() => handleReconnect(s.config)}
                  className="text-[10px] px-2 py-0.5 rounded transition-colors"
                  style={{ color: 'var(--ds-text-secondary)' }}
                >
                  重连
                </button>
              )}
              <button
                onClick={() => handleDelete(s.config.id)}
                className="text-[10px] px-2 py-0.5 rounded transition-colors"
                style={{ color: '#ef4444' }}
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {showForm && editing && (
          <div
            className="rounded-lg p-3 space-y-2.5"
            style={{ background: 'var(--ds-surface)', border: '1px solid var(--ds-blue)' }}
          >
            <h3 className="text-[12px] font-medium" style={{ color: 'var(--ds-text)' }}>
              {editing.id ? '编辑服务器' : '添加服务器'}
            </h3>

            <input
              type="text"
              placeholder="服务器名称"
              value={editing.data.name}
              onChange={(e) => setEditing({ ...editing, data: { ...editing.data, name: e.target.value } })}
              className="w-full text-[12px] px-2.5 py-1.5 rounded-md outline-none"
              style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)', border: '1px solid var(--ds-border)' }}
            />

            <select
              value={editing.data.transport}
              onChange={(e) =>
                setEditing({ ...editing, data: { ...editing.data, transport: e.target.value as MCPTransport } })
              }
              className="w-full text-[12px] px-2.5 py-1.5 rounded-md outline-none"
              style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)', border: '1px solid var(--ds-border)' }}
            >
              <option value="sse">SSE 远程连接</option>
              <option value="http">HTTP 远程连接</option>
              <option value="stdio">stdio 本地进程</option>
            </select>

            {editing.data.transport !== 'stdio' ? (
              <>
                <input
                  type="url"
                  placeholder="SSE/HTTP 端点 URL"
                  value={editing.data.url}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, url: e.target.value } })}
                  className="w-full text-[12px] px-2.5 py-1.5 rounded-md outline-none"
                  style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)', border: '1px solid var(--ds-border)' }}
                />
                <input
                  type="password"
                  placeholder="认证 Token（可选）"
                  value={editing.data.authToken}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, authToken: e.target.value } })}
                  className="w-full text-[12px] px-2.5 py-1.5 rounded-md outline-none"
                  style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)', border: '1px solid var(--ds-border)' }}
                />
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="命令 (如 npx)"
                  value={editing.data.command}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, command: e.target.value } })}
                  className="w-full text-[12px] px-2.5 py-1.5 rounded-md outline-none"
                  style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)', border: '1px solid var(--ds-border)' }}
                />
                <input
                  type="text"
                  placeholder="参数 (如 -y 12306-mcp)"
                  value={editing.data.args}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, args: e.target.value } })}
                  className="w-full text-[12px] px-2.5 py-1.5 rounded-md outline-none"
                  style={{ background: 'var(--ds-bg)', color: 'var(--ds-text)', border: '1px solid var(--ds-border)' }}
                />
                <p className="text-[10px]" style={{ color: '#a855f7' }}>
                  浏览器环境下 stdio 服务器需要本地代理。推荐使用远端 SSE/HTTP MCP Server。
                </p>
              </>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ds-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={editing.data.enabled}
                  onChange={(e) =>
                    setEditing({ ...editing, data: { ...editing.data, enabled: e.target.checked } })
                  }
                  className="w-3.5 h-3.5 rounded"
                />
                启用
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setShowForm(false); setEditing(null); }}
                  className="text-[11px] px-2.5 py-1 rounded-md"
                  style={{ color: 'var(--ds-text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="text-[11px] px-3 py-1 rounded-md font-medium disabled:opacity-50"
                  style={{ color: '#fff', background: 'var(--ds-blue)' }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
