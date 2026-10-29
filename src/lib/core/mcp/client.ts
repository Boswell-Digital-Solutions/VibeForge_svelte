/**
 * MCP Client Implementation
 * Handles connection management, protocol implementation, and event emission
 */

import type {
	JsonRpcId,
	JsonRpcRequest,
	JsonRpcResponse,
	JsonRpcError,
	McpClientConfig,
	McpClientState,
	McpConnectionStatus,
	McpServerInfo,
	McpTool,
	McpEvent,
	McpEventCallback,
	McpEventType,
	McpInitializeParams,
	McpInitializeResult,
	McpToolsListResult,
	McpToolCallParams,
	McpToolCallResult
} from './types';
import { JsonRpcErrorCode } from './types';

export class McpClient {
	private config: McpClientConfig;
	private state: McpClientState;
	private eventListeners: Map<McpEventType, Set<McpEventCallback>>;
	private websocket: WebSocket | null = null;
	private eventSource: EventSource | null = null;
	private requestId = 0;
	private pendingRequests: Map<JsonRpcId, {
		resolve: (result: unknown) => void;
		reject: (error: Error) => void;
		timeout: NodeJS.Timeout;
	}> = new Map();
	private reconnectTimeout: NodeJS.Timeout | null = null;

	constructor(config: McpClientConfig) {
		this.config = {
			autoReconnect: true,
			reconnectInterval: 5000,
			timeout: 30000,
			...config
		};

		this.state = {
			status: 'disconnected',
			serverInfo: null,
			error: null,
			tools: [],
			lastConnected: null
		};

		this.eventListeners = new Map();
	}

	// ============================================================================
	// Connection Management
	// ============================================================================

	async connect(): Promise<void> {
		if (this.state.status === 'connected' || this.state.status === 'connecting') {
			return;
		}

		this.updateStatus('connecting');

		try {
			switch (this.config.transport) {
				case 'websocket':
					await this.connectWebSocket();
					break;
				case 'sse':
					await this.connectSSE();
					break;
				case 'http':
					// HTTP is connectionless, just mark as connected
					this.updateStatus('connected');
					break;
				case 'stdio':
					throw new Error('stdio transport not supported in browser');
				default:
					throw new Error(`Unsupported transport: ${this.config.transport}`);
			}

			// Initialize the MCP connection
			await this.initialize();

			// Fetch available tools
			const toolsResult = await this.listTools();
			this.state.tools = toolsResult.tools;
			this.emit('tool-list-updated', { tools: toolsResult.tools });

			this.state.lastConnected = new Date();
			this.updateStatus('connected');
			this.emit('connected', { serverInfo: this.state.serverInfo });
		} catch (error) {
			const errorObj = error instanceof Error ? error : new Error(String(error));
			this.handleError(errorObj);
			throw errorObj;
		}
	}

	async disconnect(): Promise<void> {
		// Cancel any pending reconnection
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		// Close transport connections
		if (this.websocket) {
			this.websocket.close();
			this.websocket = null;
		}

		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		// Reject all pending requests
		for (const [id, pending] of this.pendingRequests.entries()) {
			clearTimeout(pending.timeout);
			pending.reject(new Error('Connection closed'));
			this.pendingRequests.delete(id);
		}

		this.updateStatus('disconnected');
		this.emit('disconnected', {});
	}

	private async reconnect(): Promise<void> {
		if (!this.config.autoReconnect) {
			return;
		}

		// Cancel any existing reconnection attempt
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}

		// Schedule reconnection
		this.reconnectTimeout = setTimeout(async () => {
			try {
				await this.connect();
			} catch (error) {
				// Reconnection failed, will retry again
				console.error('Reconnection failed:', error);
			}
		}, this.config.reconnectInterval);
	}

	// ============================================================================
	// Transport Layer - WebSocket
	// ============================================================================

	private connectWebSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.config.url) {
				reject(new Error('WebSocket URL not provided'));
				return;
			}

			this.websocket = new WebSocket(this.config.url);

			this.websocket.onopen = () => {
				resolve();
			};

			this.websocket.onmessage = (event) => {
				try {
					const response = JSON.parse(event.data) as JsonRpcResponse;
					this.handleResponse(response);
				} catch (error) {
					console.error('Failed to parse WebSocket message:', error);
				}
			};

			this.websocket.onerror = (event) => {
				reject(new Error('WebSocket connection error'));
			};

			this.websocket.onclose = () => {
				if (this.state.status === 'connected') {
					this.updateStatus('disconnected');
					this.emit('disconnected', {});
					this.reconnect();
				}
			};
		});
	}

	// ============================================================================
	// Transport Layer - Server-Sent Events (SSE)
	// ============================================================================

	private connectSSE(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.config.url) {
				reject(new Error('SSE URL not provided'));
				return;
			}

			this.eventSource = new EventSource(this.config.url);

			this.eventSource.onopen = () => {
				resolve();
			};

			this.eventSource.onmessage = (event) => {
				try {
					const response = JSON.parse(event.data) as JsonRpcResponse;
					this.handleResponse(response);
				} catch (error) {
					console.error('Failed to parse SSE message:', error);
				}
			};

			this.eventSource.onerror = () => {
				if (this.state.status === 'connected') {
					this.updateStatus('disconnected');
					this.emit('disconnected', {});
					this.reconnect();
				} else {
					reject(new Error('SSE connection error'));
				}
			};
		});
	}

	// ============================================================================
	// JSON-RPC Request/Response Handling
	// ============================================================================

	private async sendRequest<T>(method: string, params?: Record<string, unknown> | unknown[]): Promise<T> {
		const id = ++this.requestId;
		const request: JsonRpcRequest = {
			jsonrpc: '2.0',
			id,
			method,
			params
		};

		return new Promise((resolve, reject) => {
			// Set up timeout
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Request timeout: ${method}`));
			}, this.config.timeout);

			// Store pending request
			this.pendingRequests.set(id, {
				resolve: resolve as (result: unknown) => void,
				reject,
				timeout
			});

			// Send request based on transport
			try {
				switch (this.config.transport) {
					case 'websocket':
						if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
							throw new Error('WebSocket not connected');
						}
						this.websocket.send(JSON.stringify(request));
						break;

					case 'http':
						if (!this.config.url) {
							throw new Error('HTTP URL not provided');
						}
						// For HTTP, make a direct fetch request
						this.sendHttpRequest<T>(request).then(resolve).catch(reject);
						this.pendingRequests.delete(id);
						clearTimeout(timeout);
						break;

					case 'sse':
						// SSE requires separate POST endpoint for requests
						if (!this.config.url) {
							throw new Error('SSE URL not provided');
						}
						const postUrl = this.config.url.replace('/events', '/request');
						this.sendHttpRequest<T>(request, postUrl).then(resolve).catch(reject);
						this.pendingRequests.delete(id);
						clearTimeout(timeout);
						break;

					default:
						throw new Error(`Unsupported transport: ${this.config.transport}`);
				}
			} catch (error) {
				this.pendingRequests.delete(id);
				clearTimeout(timeout);
				reject(error);
			}
		});
	}

	private async sendHttpRequest<T>(request: JsonRpcRequest, url?: string): Promise<T> {
		const targetUrl = url || this.config.url;
		if (!targetUrl) {
			throw new Error('HTTP URL not provided');
		}

		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(request)
		});

		if (!response.ok) {
			throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
		}

		const jsonResponse = await response.json() as JsonRpcResponse<T>;

		if (jsonResponse.error) {
			throw this.createErrorFromJsonRpc(jsonResponse.error);
		}

		return jsonResponse.result as T;
	}

	private handleResponse(response: JsonRpcResponse): void {
		const pending = this.pendingRequests.get(response.id);
		if (!pending) {
			console.warn('Received response for unknown request:', response.id);
			return;
		}

		this.pendingRequests.delete(response.id);
		clearTimeout(pending.timeout);

		if (response.error) {
			pending.reject(this.createErrorFromJsonRpc(response.error));
		} else {
			pending.resolve(response.result);
		}
	}

	private createErrorFromJsonRpc(error: JsonRpcError): Error {
		const err = new Error(error.message);
		(err as any).code = error.code;
		(err as any).data = error.data;
		return err;
	}

	// ============================================================================
	// MCP Protocol Methods
	// ============================================================================

	private async initialize(): Promise<McpInitializeResult> {
		const params: McpInitializeParams = {
			protocolVersion: '2024-11-05',
			capabilities: {
				tools: {
					list: true,
					call: true
				}
			},
			clientInfo: {
				name: 'VibeForge',
				version: '2.0.0'
			}
		};

		const result = await this.sendRequest<McpInitializeResult>('initialize', params);
		this.state.serverInfo = result.serverInfo;
		return result;
	}

	async listTools(): Promise<McpToolsListResult> {
		if (this.state.status !== 'connected') {
			throw new Error('Not connected to MCP server');
		}

		return await this.sendRequest<McpToolsListResult>('tools/list');
	}

	async callTool(name: string, args?: Record<string, unknown>): Promise<McpToolCallResult> {
		if (this.state.status !== 'connected') {
			throw new Error('Not connected to MCP server');
		}

		const params: McpToolCallParams = {
			name,
			arguments: args
		};

		return await this.sendRequest<McpToolCallResult>('tools/call', params);
	}

	// ============================================================================
	// State Management
	// ============================================================================

	private updateStatus(status: McpConnectionStatus): void {
		this.state.status = status;
	}

	private handleError(error: Error): void {
		this.state.error = error;
		this.updateStatus('error');
		this.emit('error', { error });

		// Attempt reconnection if appropriate
		if (this.config.autoReconnect && this.state.status === 'error') {
			this.reconnect();
		}
	}

	getState(): Readonly<McpClientState> {
		return { ...this.state };
	}

	getTools(): readonly McpTool[] {
		return [...this.state.tools];
	}

	getServerInfo(): Readonly<McpServerInfo> | null {
		return this.state.serverInfo ? { ...this.state.serverInfo } : null;
	}

	getStatus(): McpConnectionStatus {
		return this.state.status;
	}

	isConnected(): boolean {
		return this.state.status === 'connected';
	}

	// ============================================================================
	// Event System
	// ============================================================================

	on<T = unknown>(type: McpEventType, callback: McpEventCallback<T>): void {
		if (!this.eventListeners.has(type)) {
			this.eventListeners.set(type, new Set());
		}
		this.eventListeners.get(type)!.add(callback as McpEventCallback);
	}

	off<T = unknown>(type: McpEventType, callback: McpEventCallback<T>): void {
		const listeners = this.eventListeners.get(type);
		if (listeners) {
			listeners.delete(callback as McpEventCallback);
		}
	}

	private emit<T = unknown>(type: McpEventType, data?: T): void {
		const event: McpEvent<T> = {
			type,
			timestamp: new Date(),
			data
		};

		const listeners = this.eventListeners.get(type);
		if (listeners) {
			listeners.forEach((callback) => {
				try {
					callback(event);
				} catch (error) {
					console.error(`Error in event listener for ${type}:`, error);
				}
			});
		}
	}
}
