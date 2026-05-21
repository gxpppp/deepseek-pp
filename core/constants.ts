export const DEEPSEEK_API_URL = 'https://chat.deepseek.com/api/v0/chat/completion';

export const MEMORY_TOKEN_BUDGET = 1500;

export const PRESET_REINJECTION_INTERVAL = 10;

export const MSG_PREFIX = 'DEEPSEEK_PP';

export const DSML = '｜DSML｜';

const BUILTIN_TOOL_NAMES = [
  'memory_save',
  'memory_update',
  'memory_delete',
  'skill_create',
  'skill_delete',
  'preset_create',
  'preset_delete',
  'preset_activate',
  'mcp_add_server',
  'mcp_delete_server',
  'model_switch',
];
const _extraToolNames: string[] = [];

export function getToolNames(): readonly string[] {
  return [...BUILTIN_TOOL_NAMES, ..._extraToolNames];
}

export function registerToolName(name: string): void {
  if (!BUILTIN_TOOL_NAMES.includes(name) && !_extraToolNames.includes(name)) {
    _extraToolNames.push(name);
  }
}

export function unregisterToolName(name: string): void {
  const idx = _extraToolNames.indexOf(name);
  if (idx >= 0) _extraToolNames.splice(idx, 1);
}

export function buildToolCallRegex(): RegExp {
  const names = getToolNames();
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`<(${escaped.join('|')})>\\s*([\\s\\S]*?)\\s*<\\/\\1>`, 'g');
}

const MEMORY_SAVE_SCHEMA = '{"type": "function", "function": {"name": "memory_save", "description": "保存一条新的长期记忆", "parameters": {"type": "object", "properties": {"type": {"type": "string", "enum": ["user", "feedback", "topic", "reference"], "description": "记忆类型：user=身份角色偏好, feedback=行为纠正, topic=讨论要点, reference=外部资源链接"}, "name": {"type": "string", "description": "简短标题"}, "content": {"type": "string", "description": "要保存的内容"}, "tags": {"type": "array", "items": {"type": "string"}, "description": "标签列表"}}, "required": ["type", "name", "content", "tags"]}}}';

export const MEMORY_UPDATE_SCHEMA = '{"type": "function", "function": {"name": "memory_update", "description": "更新已有记忆", "parameters": {"type": "object", "properties": {"id": {"type": "integer", "description": "记忆ID"}, "type": {"type": "string", "enum": ["user", "feedback", "topic", "reference"], "description": "记忆类型"}, "name": {"type": "string", "description": "更新后的标题"}, "content": {"type": "string", "description": "更新后的内容"}, "tags": {"type": "array", "items": {"type": "string"}, "description": "标签列表"}}, "required": ["id", "type", "name", "content", "tags"]}}}';

export const MEMORY_DELETE_SCHEMA = '{"type": "function", "function": {"name": "memory_delete", "description": "删除记忆", "parameters": {"type": "object", "properties": {"id": {"type": "integer", "description": "记忆ID"}}, "required": ["id"]}}}';

export const SKILL_CREATE_SCHEMA = '{"type":"function","function":{"name":"skill_create","description":"创建一个新的自定义技能（Skill），用户说"创建一个...技能"时使用","parameters":{"type":"object","properties":{"name":{"type":"string","description":"技能名称（英文，用于 / 触发）"},"description":{"type":"string","description":"简短描述"},"instructions":{"type":"string","description":"系统指令内容，定义该技能的行为规则"},"memoryEnabled":{"type":"boolean","description":"是否同时注入记忆上下文"}},"required":["name","description","instructions"]}}}';

export const SKILL_DELETE_SCHEMA = '{"type":"function","function":{"name":"skill_delete","description":"删除一个技能","parameters":{"type":"object","properties":{"name":{"type":"string","description":"技能名称"}},"required":["name"]}}}';

export const PRESET_CREATE_SCHEMA = '{"type":"function","function":{"name":"preset_create","description":"创建一个系统提示词预设","parameters":{"type":"object","properties":{"name":{"type":"string","description":"预设名称"},"content":{"type":"string","description":"预设的系统提示词内容"}},"required":["name","content"]}}}';

export const PRESET_DELETE_SCHEMA = '{"type":"function","function":{"name":"preset_delete","description":"删除一个预设","parameters":{"type":"object","properties":{"name":{"type":"string","description":"预设名称"}},"required":["name"]}}}';

export const PRESET_ACTIVATE_SCHEMA = '{"type":"function","function":{"name":"preset_activate","description":"激活或取消激活预设。传 name 激活指定预设，不传或传 null 取消激活","parameters":{"type":"object","properties":{"name":{"type":"string","description":"要激活的预设名称，不填则取消激活"}},"required":[]}}}';

export const MCP_ADD_SERVER_SCHEMA = '{"type":"function","function":{"name":"mcp_add_server","description":"添加一个 MCP 外部工具服务器连接","parameters":{"type":"object","properties":{"name":{"type":"string","description":"服务器名称"},"transport":{"type":"string","enum":["sse","http","stdio"],"description":"传输类型"},"url":{"type":"string","description":"SSE/HTTP 端点 URL（transport 为 sse/http 时必填）"},"authToken":{"type":"string","description":"认证 Token（可选）"},"command":{"type":"string","description":"命令（transport 为 stdio 时必填，如 npx）"},"args":{"type":"string","description":"参数，空格分隔（transport 为 stdio 时使用）"}},"required":["name","transport"]}}}';

export const MCP_DELETE_SERVER_SCHEMA = '{"type":"function","function":{"name":"mcp_delete_server","description":"删除一个 MCP 服务器","parameters":{"type":"object","properties":{"name":{"type":"string","description":"服务器名称"}},"required":["name"]}}}';

export const MODEL_SWITCH_SCHEMA = '{"type":"function","function":{"name":"model_switch","description":"切换 DeepSeek 模型类型","parameters":{"type":"object","properties":{"type":{"type":"string","enum":["expert","default"],"description":"expert=专家模式, default=普通模式"}},"required":["type"]}}}';

export const SYSTEM_TEMPLATE_CHAT = `## 角色
你是用户的私人 AI 助手，具有跨对话长期记忆能力。你能记住用户的身份、偏好、技术栈和历史对话中的关键信息，在后续对话中提供个性化的帮助。你还可以通过工具管理扩展的配置：创建技能、预设、添加 MCP 外部工具服务器、切换模型。

## 已有记忆
{{memories}}

## Tools

You have access to a set of tools. To call a tool, output an XML block with the tool name as the tag and a JSON object as the body, exactly like this:

<memory_save>
{"type": "user", "name": "用户职业", "content": "前端开发", "tags": ["前端"]}
</memory_save>

The JSON body MUST be valid JSON on its own. Do NOT add any other text inside the tags, only JSON. You can place tool calls anywhere in your reply (not only at the end).

### 记忆工具

${MEMORY_SAVE_SCHEMA}

${MEMORY_UPDATE_SCHEMA}

${MEMORY_DELETE_SCHEMA}

### 配置管理工具

${SKILL_CREATE_SCHEMA}

${SKILL_DELETE_SCHEMA}

${PRESET_CREATE_SCHEMA}

${PRESET_DELETE_SCHEMA}

${PRESET_ACTIVATE_SCHEMA}

${MCP_ADD_SERVER_SCHEMA}

${MCP_DELETE_SERVER_SCHEMA}

${MODEL_SWITCH_SCHEMA}

You MUST strictly follow the above defined tool name and parameter schemas to invoke tool calls.

## 配置管理规则

当用户要求修改扩展配置时使用对应工具：
- "创建一个...技能" → skill_create
- "删除...技能" → skill_delete
- "创建一个...预设" → preset_create
- "删除...预设" → preset_delete
- "激活/取消预设" → preset_activate
- "添加/连接 MCP 服务器" → mcp_add_server
- "删除/移除 MCP 服务器" → mcp_delete_server
- "切换模型/专家模式" → model_switch

## 记忆保存规则

当对话中出现以下任一情况时，你**必须**调用 memory_save 工具：
- 用户提到自己的身份、职业、角色
- 用户表达偏好、习惯或工作方式
- 用户纠正你的回答方式或行为
- 出现重要的技术决策、架构选型
- 用户明确说"记住"、"记下来"、"别忘了"等

### 示例

用户：我是前端开发，主要写 React 和 TypeScript
助手回复：

了解！React + TypeScript 是目前非常主流的前端技术栈。有任何相关问题都可以问我。

<memory_save>
{"type": "user", "name": "用户职业和技术栈", "content": "前端开发工程师，主要使用 React 和 TypeScript", "tags": ["前端", "React", "TypeScript"]}
</memory_save>

### 规则
- 你可以在回复中的任何位置调用工具，不限于末尾
- 工具调用后系统会自动执行并返回结果
- 仅保存长期有价值的信息，不保存一次性的问答内容
- 不要重复保存"已有记忆"中已存在的信息

`;

export const SYSTEM_TEMPLATE_THINKING = `你具有长期记忆能力。已有记忆：

{{memories}}

## Tools

You have access to a set of tools. To call a tool, output an XML block with the tool name as the tag and a JSON object as the body, exactly like this:

<memory_save>
{"type": "user", "name": "用户职业", "content": "前端开发", "tags": ["前端"]}
</memory_save>

The JSON body MUST be valid JSON on its own. Do NOT add any other text inside the tags, only JSON.

### Available Tools

${MEMORY_SAVE_SCHEMA}

${MEMORY_UPDATE_SCHEMA}

${MEMORY_DELETE_SCHEMA}

${SKILL_CREATE_SCHEMA}

${SKILL_DELETE_SCHEMA}

${PRESET_CREATE_SCHEMA}

${PRESET_DELETE_SCHEMA}

${PRESET_ACTIVATE_SCHEMA}

${MCP_ADD_SERVER_SCHEMA}

${MCP_DELETE_SERVER_SCHEMA}

${MODEL_SWITCH_SCHEMA}

You MUST strictly follow the above defined tool name and parameter schemas to invoke tool calls.

当用户透露重要的持久信息（身份、偏好、行为纠正、重要决策）时，你**必须**调用 memory_save 工具保存。当用户要求修改配置（创建技能/预设、添加 MCP 服务器、切换模型等）时使用对应管理工具。你可以在回复中的任何位置调用工具。仅保存长期有价值的信息；不要重复保存已有记忆。

---

`;

export const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '里', '之', '中', '与', '而', '为',
  '以', '及', '等', '被', '把', '让', '给', '从', '向', '对', '但', '如果', '因为',
  '所以', '虽然', '可以', '能', '想', '知道', '时候', '没', '什么', '怎么', '这个',
  '那个', '还', '过', '吗', '呢', '吧', '啊', '嗯', '哦', '呀', '啦', '使用',
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
  'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his',
  'by', 'from', 'they', 'we', 'she', 'or', 'an', 'will', 'my', 'one', 'all',
  'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who',
  'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'no', 'just',
  'him', 'know', 'take', 'into', 'your', 'some', 'could', 'them', 'than',
  'other', 'been', 'has', 'its', 'use', 'two', 'how', 'our', 'way',
]);

export const TOOL_CALL_REGEX = buildToolCallRegex();

export const SKILL_TRIGGER_REGEX = /^\/(\S+)\s*([\s\S]*)$/;
