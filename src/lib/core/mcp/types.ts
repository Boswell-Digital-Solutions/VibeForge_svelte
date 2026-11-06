/**
 * JSON-RPC 2.0 and MCP Protocol Types
 * Based on Model Context Protocol specification
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
	jsonrpc: '2.0';
	id: JsonRpcId;
	method: string;
	params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcResponse<T = unknown> {
	jsonrpc: '2.0';
	id: JsonRpcId;
	result?: T;
	error?: JsonRpcError;
}

export interface JsonRpcError {
	code: number;
	message: string;
	data?: unknown;
}

export interface JsonRpcNotification {
	jsonrpc: '2.0';
	method: string;
	params?: Record<string, unknown> | unknown[];
}

// JSON-RPC Error Codes
export const JsonRpcErrorCode = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603,
	// MCP-specific error codes
	SERVER_ERROR: -32000,
	TOOL_ERROR: -32001,
	TIMEOUT_ERROR: -32002
} as const;

// ============================================================================
// MCP Protocol Types
// ============================================================================

export type McpTransportType = 'stdio' | 'http' | 'websocket' | 'sse';

export interface McpServerInfo {
	name: string;
	version: string;
	description?: string;
	capabilities?: McpCapabilities;
}

export interface McpCapabilities {
	tools?: {
		list: boolean;
		call: boolean;
	};
	resources?: {
		list: boolean;
		read: boolean;
	};
	prompts?: {
		list: boolean;
		get: boolean;
	};
}

export interface McpTool {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, McpSchemaProperty>;
		required?: string[];
	};
}

export interface McpSchemaProperty {
	type: string;
	description?: string;
	enum?: string[];
	items?: {
		type: string;
	};
}

export interface McpToolCallParams {
	name: string;
	arguments?: Record<string, unknown>;
	/** JSON-RPC params are a structured JSON value. */
	[key: string]: unknown;
}

export interface McpToolResult {
	content: Array<{
		type: 'text' | 'image' | 'resource';
		text?: string;
		data?: string;
		mimeType?: string;
	}>;
	isError?: boolean;
}

// ============================================================================
// MCP Method Types
// ============================================================================

// initialize
export interface McpInitializeParams {
	protocolVersion: string;
	capabilities: McpCapabilities;
	clientInfo: {
		name: string;
		version: string;
	};
	/** JSON-RPC params are a structured JSON value. */
	[key: string]: unknown;
}

export interface McpInitializeResult {
	protocolVersion: string;
	capabilities: McpCapabilities;
	serverInfo: McpServerInfo;
}

// tools/list
export interface McpToolsListResult {
	tools: McpTool[];
}

// tools/call
export interface McpToolCallResult extends McpToolResult {}

// ============================================================================
// MCP Client Types
// ============================================================================

export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpClientConfig {
	serverName: string;
	transport: McpTransportType;
	url?: string; // for http/websocket/sse
	command?: string; // for stdio
	args?: string[]; // for stdio
	env?: Record<string, string>; // for stdio
	autoReconnect?: boolean;
	reconnectInterval?: number; // ms
	timeout?: number; // ms
}

export interface McpClientState {
	status: McpConnectionStatus;
	serverInfo: McpServerInfo | null;
	error: Error | null;
	tools: McpTool[];
	lastConnected: Date | null;
}

// ============================================================================
// MCP Events
// ============================================================================

export type McpEventType =
	| 'connected'
	| 'disconnected'
	| 'error'
	| 'tool-list-updated'
	| 'notification';

export interface McpEvent<T = unknown> {
	type: McpEventType;
	timestamp: Date;
	data?: T;
}

export type McpEventCallback<T = unknown> = (event: McpEvent<T>) => void;
