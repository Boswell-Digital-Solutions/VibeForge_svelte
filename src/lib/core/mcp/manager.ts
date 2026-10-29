/**
 * MCP Client Manager
 * Manages multiple MCP server connections and provides high-level API
 */

import { McpClient } from './client';
import type {
	McpClientConfig,
	McpServerInfo,
	McpTool,
	McpConnectionStatus
} from './types';

export interface ManagedServer {
	id: string;
	name: string;
	description: string;
	status: McpConnectionStatus;
	config: McpClientConfig;
	client: McpClient;
	tools: McpTool[];
	error: string | null;
}

export class McpClientManager {
	private servers: Map<string, ManagedServer> = new Map();
	private listeners: Set<() => void> = new Set();

	constructor() {
		// Initialize with default servers
		this.addDefaultServers();
	}

	// ============================================================================
	// Server Management
	// ============================================================================

	private addDefaultServers(): void {
		// DataForge MCP Server (http://localhost:8001/mcp)
		this.registerServer({
			id: 'mcp_dataforge',
			name: 'DataForge MCP',
			description: 'Knowledge base queries and context management',
			config: {
				serverName: 'DataForge',
				transport: 'http',
				url: 'http://localhost:8001/mcp',
				autoReconnect: true,
				reconnectInterval: 5000,
				timeout: 30000
			}
		});

		// NeuroForge MCP Server (http://localhost:8000/mcp)
		this.registerServer({
			id: 'mcp_neuroforge',
			name: 'NeuroForge MCP',
			description: 'Model routing and execution',
			config: {
				serverName: 'NeuroForge',
				transport: 'http',
				url: 'http://localhost:8000/mcp',
				autoReconnect: true,
				reconnectInterval: 5000,
				timeout: 30000
			}
		});
	}

	registerServer(params: {
		id: string;
		name: string;
		description: string;
		config: McpClientConfig;
	}): void {
		const client = new McpClient(params.config);

		const server: ManagedServer = {
			id: params.id,
			name: params.name,
			description: params.description,
			status: 'disconnected',
			config: params.config,
			client,
			tools: [],
			error: null
		};

		// Set up event listeners
		client.on('connected', () => {
			server.status = 'connected';
			server.error = null;
			this.notifyListeners();
		});

		client.on('disconnected', () => {
			server.status = 'disconnected';
			this.notifyListeners();
		});

		client.on<{ error?: { message?: string } }>('error', (event) => {
			server.status = 'error';
			server.error = event.data?.error?.message || 'Unknown error';
			this.notifyListeners();
		});

		client.on<{ tools?: McpTool[] }>('tool-list-updated', (event) => {
			server.tools = event.data?.tools || [];
			this.notifyListeners();
		});

		this.servers.set(params.id, server);
		this.notifyListeners();
	}

	unregisterServer(serverId: string): void {
		const server = this.servers.get(serverId);
		if (server) {
			server.client.disconnect();
			this.servers.delete(serverId);
			this.notifyListeners();
		}
	}

	// ============================================================================
	// Connection Management
	// ============================================================================

	async connectServer(serverId: string): Promise<void> {
		const server = this.servers.get(serverId);
		if (!server) {
			throw new Error(`Server not found: ${serverId}`);
		}

		try {
			await server.client.connect();
		} catch (error) {
			throw new Error(`Failed to connect to ${server.name}: ${error}`);
		}
	}

	async disconnectServer(serverId: string): Promise<void> {
		const server = this.servers.get(serverId);
		if (!server) {
			throw new Error(`Server not found: ${serverId}`);
		}

		await server.client.disconnect();
	}

	async connectAll(): Promise<void> {
		const promises = Array.from(this.servers.keys()).map(id =>
			this.connectServer(id).catch(error => {
				console.error(`Failed to connect to ${id}:`, error);
			})
		);

		await Promise.all(promises);
	}

	async disconnectAll(): Promise<void> {
		const promises = Array.from(this.servers.keys()).map(id =>
			this.disconnectServer(id)
		);

		await Promise.all(promises);
	}

	// ============================================================================
	// Server Queries
	// ============================================================================

	listServers(params?: { includeDisconnected?: boolean }): ManagedServer[] {
		const servers = Array.from(this.servers.values());

		if (params?.includeDisconnected) {
			return servers;
		}

		return servers.filter(s => s.status === 'connected');
	}

	getServer(serverId: string): ManagedServer | undefined {
		return this.servers.get(serverId);
	}

	getServerInfo(serverId: string): McpServerInfo | null {
		const server = this.servers.get(serverId);
		if (!server) {
			return null;
		}

		return server.client.getServerInfo();
	}

	// ============================================================================
	// Tool Operations
	// ============================================================================

	listTools(serverId: string): McpTool[] {
		const server = this.servers.get(serverId);
		if (!server) {
			return [];
		}

		return server.tools;
	}

	getAllTools(): Array<{ serverId: string; serverName: string; tools: McpTool[] }> {
		return Array.from(this.servers.values())
			.filter(s => s.status === 'connected')
			.map(s => ({
				serverId: s.id,
				serverName: s.name,
				tools: s.tools
			}));
	}

	async callTool(
		serverId: string,
		toolName: string,
		args?: Record<string, unknown>
	): Promise<any> {
		const server = this.servers.get(serverId);
		if (!server) {
			throw new Error(`Server not found: ${serverId}`);
		}

		if (server.status !== 'connected') {
			throw new Error(`Server not connected: ${server.name}`);
		}

		return await server.client.callTool(toolName, args);
	}

	// ============================================================================
	// Event System
	// ============================================================================

	onChange(callback: () => void): void {
		this.listeners.add(callback);
	}

	offChange(callback: () => void): void {
		this.listeners.delete(callback);
	}

	private notifyListeners(): void {
		this.listeners.forEach(callback => {
			try {
				callback();
			} catch (error) {
				console.error('Error in manager listener:', error);
			}
		});
	}
}

// Singleton instance
export const mcpManager = new McpClientManager();
