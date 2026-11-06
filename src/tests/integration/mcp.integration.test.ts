/**
 * MCP Integration Tests
 * Tests for Model Context Protocol client integration with real server scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpClient } from '$lib/core/mcp/client';
import { McpClientManager } from '$lib/core/mcp/manager';
import type { McpClientConfig } from '$lib/core/mcp/types';

const SERVER_INFO = {
	protocolVersion: '1.0',
	serverInfo: { name: 'Test Server', version: '1.0.0' }
};

const TOOLS = {
	queryKB: {
		name: 'queryKB',
		description: 'Query knowledge base',
		inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
	},
	ingestDocument: {
		name: 'ingestDocument',
		description: 'Ingest document',
		inputSchema: { type: 'object', properties: { content: { type: 'string' } } }
	}
};

/**
 * Answer by JSON-RPC method rather than by call order.
 *
 * connect() issues both `initialize` and `tools/list`, so an ordered chain of
 * mockResolvedValueOnce is spent on the handshake and every later request reads
 * undefined. A value of Error rejects; `httpError` answers with a failed
 * response instead.
 */
function mockRpc(
	results: Record<string, unknown>,
	options: { httpError?: { status: number; body: unknown } } = {}
) {
	return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body ?? '{}')) as {
			id?: number;
			method?: string;
		};
		const method = body.method ?? '';

		if (options.httpError && !(method in results)) {
			return {
				ok: false,
				status: options.httpError.status,
				json: async () => options.httpError!.body
			} as Response;
		}

		if (!(method in results)) {
			throw new Error(`Unexpected JSON-RPC method: ${method}`);
		}

		const value = results[method];
		if (value instanceof Error) {
			throw value;
		}

		return {
			ok: true,
			status: 200,
			json: async () => ({ jsonrpc: '2.0', id: body.id, result: value })
		} as Response;
	});
}

function clientConfig(overrides: Partial<McpClientConfig> = {}): McpClientConfig {
	return {
		serverName: 'Test Server',
		transport: 'http',
		url: 'http://localhost:8001',
		autoReconnect: false,
		...overrides
	};
}

/** The handshake: initialize, then the tool list connect() fetches. */
function handshake(tools: unknown[] = [TOOLS.queryKB, TOOLS.ingestDocument]) {
	return { initialize: SERVER_INFO, 'tools/list': { tools } };
}

describe('MCP Client Integration', () => {
	let client: McpClient;

	beforeEach(() => {
		client = new McpClient(clientConfig());
	});

	afterEach(async () => {
		await client.disconnect();
		vi.restoreAllMocks();
	});

	describe('Connection Management', () => {
		it('should connect to server successfully', async () => {
			global.fetch = mockRpc(handshake());

			await client.connect();

			expect(client.isConnected()).toBe(true);
			expect(client.getStatus()).toBe('connected');
			expect(client.getServerInfo()).toEqual(SERVER_INFO.serverInfo);
		});

		it('should handle connection failure gracefully', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

			await expect(client.connect()).rejects.toThrow();
			expect(client.isConnected()).toBe(false);
			expect(client.getStatus()).toBe('error');
		});

		it('should reconnect after disconnect', async () => {
			global.fetch = mockRpc(handshake());

			await client.connect();
			expect(client.isConnected()).toBe(true);

			await client.disconnect();
			expect(client.isConnected()).toBe(false);
			expect(client.getStatus()).toBe('disconnected');

			await client.connect();
			expect(client.isConnected()).toBe(true);
		});

		it('should emit connection events', async () => {
			global.fetch = mockRpc(handshake());

			const connected = vi.fn();
			const toolsUpdated = vi.fn();
			client.on('connected', connected);
			client.on('tool-list-updated', toolsUpdated);

			await client.connect();

			expect(connected).toHaveBeenCalled();
			expect(toolsUpdated).toHaveBeenCalled();
		});
	});

	describe('Tool Discovery', () => {
		it('should list available tools', async () => {
			global.fetch = mockRpc(handshake());

			await client.connect();
			const result = await client.listTools();

			// listTools resolves McpToolsListResult, not a bare array.
			expect(result.tools).toHaveLength(2);
			expect(result.tools[0].name).toBe('queryKB');
			expect(result.tools[1].name).toBe('ingestDocument');
		});

		it('should handle empty tool list', async () => {
			global.fetch = mockRpc(handshake([]));

			await client.connect();
			const result = await client.listTools();

			expect(result.tools).toHaveLength(0);
		});

		it('should cache the tool list from the handshake', async () => {
			global.fetch = mockRpc(handshake());

			await client.connect();

			expect(client.getTools()).toHaveLength(2);
		});
	});

	describe('Tool Invocation', () => {
		it('should invoke tool successfully', async () => {
			global.fetch = mockRpc({
				...handshake(),
				'tools/call': {
					content: [{ type: 'text', text: 'Query result: 5 documents found' }]
				}
			});

			await client.connect();
			const result = await client.callTool('queryKB', { query: 'test query' });

			expect(result.content[0].text).toContain('5 documents found');
		});

		it('should handle tool invocation errors', async () => {
			global.fetch = mockRpc(handshake(), {
				httpError: {
					status: 400,
					body: {
						jsonrpc: '2.0',
						id: 2,
						error: { code: -32602, message: 'Invalid params' }
					}
				}
			});

			await client.connect();

			await expect(client.callTool('queryKB', { invalid: 'params' })).rejects.toThrow();
		});

		it('should refuse to call a tool while disconnected', async () => {
			await expect(client.callTool('queryKB', {})).rejects.toThrow(/Not connected/i);
		});

		it('should timeout long-running tool calls', async () => {
			const slowClient = new McpClient(clientConfig({ timeout: 50 }));
			const handshakeMock = mockRpc(handshake());

			global.fetch = vi.fn(async (url, init) => {
				const body = JSON.parse(String((init as RequestInit)?.body ?? '{}'));
				if (body.method === 'tools/call') {
					// Never answers, so the client's own timeout has to fire.
					return new Promise<Response>(() => {});
				}
				return handshakeMock(url as string, init as RequestInit);
			}) as unknown as typeof fetch;

			await slowClient.connect();

			await expect(slowClient.callTool('slowTool', {})).rejects.toThrow(/timeout/i);

			await slowClient.disconnect();
		});
	});

	describe('Error Recovery', () => {
		it('should not retry a failed handshake inside connect()', async () => {
			const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
			global.fetch = fetchMock;

			await expect(client.connect()).rejects.toThrow();

			// The client schedules an autoReconnect timer instead of retrying the
			// request in place, so connect() makes exactly one attempt.
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('should handle server disconnection', async () => {
			global.fetch = mockRpc(handshake());

			const disconnectHandler = vi.fn();
			client.on('disconnected', disconnectHandler);

			await client.connect();
			expect(client.isConnected()).toBe(true);

			await client.disconnect();

			expect(disconnectHandler).toHaveBeenCalled();
			expect(client.isConnected()).toBe(false);
		});
	});
});

describe('MCP Connection Manager Integration', () => {
	let manager: McpClientManager;

	beforeEach(() => {
		manager = new McpClientManager();
	});

	afterEach(async () => {
		await manager.disconnectAll();
		vi.restoreAllMocks();
	});

	/** Register and connect in one step; the manager separates the two. */
	async function addServer(id: string, name: string, url: string) {
		manager.registerServer({
			id,
			name,
			description: `${name} test server`,
			config: clientConfig({ serverName: name, url })
		});
		await manager.connectServer(id);
	}

	describe('Multi-Server Management', () => {
		it('should connect to multiple servers', async () => {
			global.fetch = mockRpc(handshake());

			await addServer('dataforge', 'DataForge', 'http://localhost:8001');
			await addServer('neuroforge', 'NeuroForge', 'http://localhost:8000');

			// listServers() reports only connected servers by default.
			expect(manager.listServers()).toHaveLength(2);
		});

		it('should list all tools from all servers', async () => {
			global.fetch = mockRpc(handshake([TOOLS.queryKB]));

			await addServer('server1', 'Server 1', 'http://localhost:8001');
			await addServer('server2', 'Server 2', 'http://localhost:8002');

			// getAllTools() is synchronous and groups tools per server.
			const allTools = manager.getAllTools();

			expect(allTools).toHaveLength(2);
			expect(allTools.map((entry) => entry.serverId).sort()).toEqual([
				'server1',
				'server2'
			]);
			expect(allTools[0].tools[0].name).toBe('queryKB');
		});

		it('should disconnect from specific server', async () => {
			global.fetch = mockRpc(handshake());

			await addServer('server1', 'Server 1', 'http://localhost:8001');
			await addServer('server2', 'Server 2', 'http://localhost:8002');
			expect(manager.listServers()).toHaveLength(2);

			await manager.disconnectServer('server1');

			const connected = manager.listServers();
			expect(connected).toHaveLength(1);
			expect(connected[0].id).toBe('server2');
			// The manager pre-registers default servers, so assert on this one.
			const all = manager.listServers({ includeDisconnected: true });
			expect(all.find((entry) => entry.id === 'server1')?.status).toBe(
				'disconnected'
			);
		});

		it('should refuse to connect an unregistered server', async () => {
			await expect(manager.connectServer('missing')).rejects.toThrow(/not found/i);
		});
	});

	describe('Event Handling', () => {
		it('should emit server connected event', async () => {
			global.fetch = mockRpc(handshake());

			const onChange = vi.fn();
			manager.onChange(onChange);

			await addServer('server1', 'Server 1', 'http://localhost:8001');

			expect(onChange).toHaveBeenCalled();
			expect(manager.getServer('server1')?.status).toBe('connected');
		});

		it('should emit server disconnected event', async () => {
			global.fetch = mockRpc(handshake());

			await addServer('server1', 'Server 1', 'http://localhost:8001');

			const onChange = vi.fn();
			manager.onChange(onChange);

			await manager.disconnectServer('server1');

			expect(onChange).toHaveBeenCalled();
			expect(manager.getServer('server1')?.status).toBe('disconnected');
		});
	});
});
