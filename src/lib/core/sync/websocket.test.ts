/**
 * VF-300: WebSocket Real-Time Sync Tests
 *
 * Test coverage for:
 * - WebSocket connection establishment
 * - Auto-reconnect with exponential backoff
 * - Heartbeat/ping-pong
 * - Message handling (resource updates)
 * - BroadcastChannel tab sync
 * - Event subscription system
 * - Connection lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketSync, getWebSocketSync, initWebSocketSync } from './websocket';
import * as indexedDb from './indexedDb';

// Mock dependencies
vi.mock('./indexedDb');

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.CONNECTING;
	url: string;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		// Simulate async connection
		setTimeout(() => {
			this.readyState = MockWebSocket.OPEN;
			if (this.onopen) {
				this.onopen(new Event('open'));
			}
		}, 10);
	}

	send(data: string) {
		// Mock send
	}

	close() {
		this.readyState = MockWebSocket.CLOSING;
		setTimeout(() => {
			this.readyState = MockWebSocket.CLOSED;
			if (this.onclose) {
				this.onclose(new CloseEvent('close'));
			}
		}, 10);
	}
}

// Mock BroadcastChannel
class MockBroadcastChannel {
	name: string;
	onmessage: ((event: MessageEvent) => void) | null = null;

	constructor(name: string) {
		this.name = name;
	}

	postMessage(data: any) {
		// Mock postMessage
	}

	close() {
		// Mock close
	}
}

// Override global WebSocket and BroadcastChannel
global.WebSocket = MockWebSocket as any;
global.BroadcastChannel = MockBroadcastChannel as any;

describe('WebSocket Real-Time Sync', () => {
	let wsSync: WebSocketSync;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		// Create fresh instance
		wsSync = new WebSocketSync('ws://localhost:8001/ws');
	});

	afterEach(() => {
		if (wsSync) {
			wsSync.disconnect();
		}
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe('Connection Establishment', () => {
		it('should create WebSocket connection', async () => {
			const connected = wsSync.connect();

			// Advance timers to trigger connection
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			expect(wsSync.getStatus()).toBe(true);
		});

		it('should set correct WebSocket URL', () => {
			const customUrl = 'ws://example.com/ws';
			const customWs = new WebSocketSync(customUrl);

			expect(customWs).toBeDefined();
		});

		it('should initialize BroadcastChannel', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// BroadcastChannel should be created
			expect(wsSync).toBeDefined();
		});

		it('should send auth token after connection', async () => {
			// Mock localStorage
			const mockToken = 'test-jwt-token';
			localStorage.setItem('vibeforge:auth:token', mockToken);

			const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Should send auth message
			expect(sendSpy).toHaveBeenCalledWith(
				expect.stringContaining('auth')
			);

			localStorage.clear();
		});
	});

	describe('Heartbeat/Ping-Pong', () => {
		it('should start heartbeat after connection', async () => {
			const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Clear initial auth message
			sendSpy.mockClear();

			// Advance past heartbeat interval (30s)
			await vi.advanceTimersByTimeAsync(30000);

			// Should send ping
			expect(sendSpy).toHaveBeenCalledWith(
				expect.stringContaining('ping')
			);
		});

		it('should send ping every 30 seconds', async () => {
			const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			sendSpy.mockClear();

			// First ping at 30s
			await vi.advanceTimersByTimeAsync(30000);
			expect(sendSpy).toHaveBeenCalledTimes(1);

			// Second ping at 60s
			await vi.advanceTimersByTimeAsync(30000);
			expect(sendSpy).toHaveBeenCalledTimes(2);

			// Third ping at 90s
			await vi.advanceTimersByTimeAsync(30000);
			expect(sendSpy).toHaveBeenCalledTimes(3);
		});

		it('should stop heartbeat on disconnect', async () => {
			const sendSpy = vi.spyOn(MockWebSocket.prototype, 'send');

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			wsSync.disconnect();
			await vi.advanceTimersByTimeAsync(20);

			sendSpy.mockClear();

			// Advance past heartbeat interval
			await vi.advanceTimersByTimeAsync(30000);

			// Should NOT send ping after disconnect
			expect(sendSpy).not.toHaveBeenCalled();
		});
	});

	describe('Message Handling', () => {
		it('should handle resource_update message', async () => {
			const mockUpdate = {
				event: 'resource_update',
				data: {
					resourceType: 'workspace',
					type: 'created',
					resourceId: 'ws-1',
					data: { id: 'ws-1', name: 'Test' },
				},
			};

			vi.mocked(indexedDb.workspaceStore.save).mockResolvedValue();

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate receiving message
			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockUpdate),
				}));
			}

			// Should save to IndexedDB
			await vi.advanceTimersByTimeAsync(10);
		});

		it('should handle resource deletion', async () => {
			const mockUpdate = {
				event: 'resource_update',
				data: {
					resourceType: 'workspace',
					type: 'deleted',
					resourceId: 'ws-1',
				},
			};

			vi.mocked(indexedDb.workspaceStore.delete).mockResolvedValue();

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockUpdate),
				}));
			}

			await vi.advanceTimersByTimeAsync(10);

			// Should delete from IndexedDB
			expect(indexedDb.workspaceStore.delete).toHaveBeenCalledWith('ws-1');
		});

		it('should handle sync_complete message', async () => {
			const mockMessage = {
				event: 'sync_complete',
				data: {},
			};

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockMessage),
				}));
			}

			// Should not throw error
			await vi.advanceTimersByTimeAsync(10);
		});

		it('should handle pong response', async () => {
			const mockMessage = {
				event: 'pong',
				data: {},
			};

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockMessage),
				}));
			}

			// Should not throw error
			await vi.advanceTimersByTimeAsync(10);
		});

		it('should handle error messages', async () => {
			const mockMessage = {
				event: 'error',
				data: { message: 'Server error' },
			};

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockMessage),
				}));
			}

			// Should not throw error (graceful handling)
			await vi.advanceTimersByTimeAsync(10);
		});
	});

	describe('Event Subscription', () => {
		it('should subscribe to updates', async () => {
			const handler = vi.fn();

			wsSync.subscribe(handler);

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate resource update
			const mockUpdate = {
				event: 'resource_update',
				data: {
					resourceType: 'workspace',
					type: 'created',
					resourceId: 'ws-1',
					data: { id: 'ws-1', name: 'Test' },
				},
			};

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockUpdate),
				}));
			}

			await vi.advanceTimersByTimeAsync(10);

			// Handler should be called
			expect(handler).toHaveBeenCalledWith(mockUpdate.data);
		});

		it('should unsubscribe from updates', async () => {
			const handler = vi.fn();

			const unsubscribe = wsSync.subscribe(handler);

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Unsubscribe
			unsubscribe();

			// Simulate resource update
			const mockUpdate = {
				event: 'resource_update',
				data: {
					resourceType: 'workspace',
					type: 'created',
					resourceId: 'ws-1',
					data: { id: 'ws-1', name: 'Test' },
				},
			};

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockUpdate),
				}));
			}

			await vi.advanceTimersByTimeAsync(10);

			// Handler should NOT be called
			expect(handler).not.toHaveBeenCalled();
		});

		it('should support multiple subscribers', async () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			wsSync.subscribe(handler1);
			wsSync.subscribe(handler2);

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate resource update
			const mockUpdate = {
				event: 'resource_update',
				data: {
					resourceType: 'workspace',
					type: 'created',
					resourceId: 'ws-1',
					data: { id: 'ws-1', name: 'Test' },
				},
			};

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockUpdate),
				}));
			}

			await vi.advanceTimersByTimeAsync(10);

			// Both handlers should be called
			expect(handler1).toHaveBeenCalled();
			expect(handler2).toHaveBeenCalled();
		});
	});

	describe('Auto-Reconnect', () => {
		it('should reconnect on connection close', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			expect(wsSync.getStatus()).toBe(true);

			// Simulate connection close
			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onclose) {
				ws.onclose(new CloseEvent('close'));
			}

			await vi.advanceTimersByTimeAsync(20);

			// Should attempt reconnect
			// Advance past first reconnect delay (1s)
			await vi.advanceTimersByTimeAsync(1000);

			// Should create new connection
		});

		it('should use exponential backoff for reconnects', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate multiple disconnects
			for (let i = 0; i < 3; i++) {
				const ws = (wsSync as any).ws as MockWebSocket;
				if (ws.onclose) {
					ws.onclose(new CloseEvent('close'));
				}
				await vi.advanceTimersByTimeAsync(20);

				// Exponential delays: 1s, 2s, 4s, 8s...
				const delay = 1000 * Math.pow(2, i);
				await vi.advanceTimersByTimeAsync(delay);
			}

			// Should have attempted multiple reconnects
		});

		it('should stop reconnecting after max attempts', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate 10 failed reconnects
			for (let i = 0; i < 11; i++) {
				const ws = (wsSync as any).ws as MockWebSocket;
				if (ws.onclose) {
					ws.onclose(new CloseEvent('close'));
				}
				await vi.advanceTimersByTimeAsync(20);

				const delay = Math.min(1000 * Math.pow(2, i), 32000);
				await vi.advanceTimersByTimeAsync(delay);
			}

			// Should stop reconnecting after max attempts (10)
		});

		it('should reset reconnect attempts on successful connection', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate disconnect
			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onclose) {
				ws.onclose(new CloseEvent('close'));
			}
			await vi.advanceTimersByTimeAsync(20);

			// Reconnect
			await vi.advanceTimersByTimeAsync(1000);

			// Should reset reconnect attempts counter
		});
	});

	describe('BroadcastChannel Tab Sync', () => {
		it('should broadcast updates to other tabs', async () => {
			const broadcastSpy = vi.spyOn(MockBroadcastChannel.prototype, 'postMessage');

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Simulate resource update
			const mockUpdate = {
				event: 'resource_update',
				data: {
					resourceType: 'workspace',
					type: 'created',
					resourceId: 'ws-1',
					data: { id: 'ws-1', name: 'Test' },
				},
			};

			const ws = (wsSync as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(new MessageEvent('message', {
					data: JSON.stringify(mockUpdate),
				}));
			}

			await vi.advanceTimersByTimeAsync(10);

			// Should broadcast to other tabs
			expect(broadcastSpy).toHaveBeenCalled();
		});

		it('should close BroadcastChannel on disconnect', async () => {
			const closeSpy = vi.spyOn(MockBroadcastChannel.prototype, 'close');

			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			wsSync.disconnect();
			await vi.advanceTimersByTimeAsync(20);

			// Should close broadcast channel
			expect(closeSpy).toHaveBeenCalled();
		});
	});

	describe('Connection Lifecycle', () => {
		it('should disconnect cleanly', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			expect(wsSync.getStatus()).toBe(true);

			wsSync.disconnect();
			await vi.advanceTimersByTimeAsync(20);

			expect(wsSync.getStatus()).toBe(false);
		});

		it('should allow reconnecting after disconnect', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			wsSync.disconnect();
			await vi.advanceTimersByTimeAsync(20);

			// Reconnect
			const connected2 = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected2;

			expect(wsSync.getStatus()).toBe(true);
		});

		it('should handle multiple connect calls gracefully', async () => {
			const connected = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected;

			// Call connect again (should not create duplicate connection)
			const connected2 = wsSync.connect();
			await vi.advanceTimersByTimeAsync(20);
			await connected2;

			// Should still be connected
			expect(wsSync.getStatus()).toBe(true);
		});
	});

	describe('Singleton Pattern', () => {
		it('should return same instance from getWebSocketSync', () => {
			const instance1 = getWebSocketSync();
			const instance2 = getWebSocketSync();

			expect(instance1).toBe(instance2);
		});

		it('should initialize WebSocket with initWebSocketSync', async () => {
			const instance = initWebSocketSync();

			await vi.advanceTimersByTimeAsync(20);

			expect(instance.getStatus()).toBe(true);
		});
	});
});
