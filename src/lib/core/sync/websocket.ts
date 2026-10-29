/**
 * VibeForge V2 - WebSocket Real-Time Sync (VF-300)
 *
 * Real-time synchronization across tabs and devices:
 * - WebSocket connection to DataForge
 * - Listen to server-sent resource updates
 * - Automatically update local IndexedDB cache
 * - Broadcast to all open tabs via BroadcastChannel
 * - Auto-reconnect with exponential backoff
 *
 * Phase 3 - Track A: Backend Persistence
 */

import type { Workspace, ContextBlock } from "$lib/core/types";
import type { Run, PromptTemplate } from "$lib/core/api/dataforgeClient.enhanced";
import * as indexedDb from "./indexedDb";

// ============================================================================
// TYPES
// ============================================================================

export type ResourceUpdate = {
  type: 'created' | 'updated' | 'deleted';
  resourceType: 'workspace' | 'contextBlock' | 'run' | 'promptTemplate';
  resourceId: string;
  data?: Workspace | ContextBlock | Run | PromptTemplate;
  userId: string;
  timestamp: string;
};

export type WebSocketMessage =
  | { event: 'ping' }
  | { event: 'pong' }
  | { event: 'resource_update'; data: ResourceUpdate }
  | { event: 'sync_complete'; data: { count: number } }
  | { event: 'error'; data: { code: string; message: string } };

export type WebSocketEventHandler = (update: ResourceUpdate) => void;

// ============================================================================
// WebSocket Client
// ============================================================================

export class WebSocketSync {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private handlers: WebSocketEventHandler[] = [];
  private broadcast: BroadcastChannel | null = null;
  private isConnected = false;

  constructor(url?: string) {
    const DATAFORGE_WS_URL =
      url || import.meta.env.VITE_DATAFORGE_WS_URL || "ws://localhost:8001/ws";
    this.url = DATAFORGE_WS_URL;

    // Create BroadcastChannel for tab synchronization
    this.openBroadcastChannel();
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    // disconnect() closes the channel, so reopen it when reconnecting.
    this.openBroadcastChannel();

    return new Promise((resolve, reject) => {
      try {
        console.log(`[WebSocket] Connecting to ${this.url}...`);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.startHeartbeat();

          // Send auth token
          const token = localStorage.getItem('vibeforge:auth:token');
          if (token) {
            this.send({ event: 'auth', data: { token } });
          }

          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            await this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Connection closed');
          this.isConnected = false;
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.broadcast) {
      this.broadcast.close();
      this.broadcast = null;
    }
    this.stopHeartbeat();
    this.isConnected = false;
  }

  /**
   * Subscribe to resource updates
   */
  subscribe(handler: WebSocketEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  /**
   * Get connection status
   */
  getStatus(): boolean {
    return this.isConnected;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /** Open the tab-sync channel if the environment has one and it is not open. */
  private openBroadcastChannel(): void {
    if (this.broadcast || typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.broadcast = new BroadcastChannel('vibeforge-sync');
    this.broadcast.onmessage = (event) => {
      // Handle updates from other tabs
      if (event.data.type === 'resource_update') {
        this.notifyHandlers(event.data.update);
      }
    };
  }

  private async handleMessage(message: WebSocketMessage): Promise<void> {
    switch (message.event) {
      case 'ping':
        this.send({ event: 'pong' });
        break;

      case 'pong':
        // Heartbeat acknowledged
        break;

      case 'resource_update':
        await this.handleResourceUpdate(message.data);
        break;

      case 'sync_complete':
        console.log(`[WebSocket] Sync complete: ${message.data.count} resources`);
        break;

      case 'error':
        console.error(`[WebSocket] Server error: ${message.data.code} - ${message.data.message}`);
        break;

      default:
        console.warn('[WebSocket] Unknown message event:', message);
    }
  }

  private async handleResourceUpdate(update: ResourceUpdate): Promise<void> {
    console.log(`[WebSocket] Resource update: ${update.resourceType} ${update.type}`);

    try {
      // Update local IndexedDB cache
      switch (update.resourceType) {
        case 'workspace':
          if (update.type === 'deleted') {
            await indexedDb.workspaceStore.delete(update.resourceId);
          } else if (update.data) {
            await indexedDb.workspaceStore.save(update.data as Workspace);
          }
          break;

        case 'contextBlock':
          if (update.type === 'deleted') {
            await indexedDb.contextBlockStore.delete(update.resourceId);
          } else if (update.data) {
            await indexedDb.contextBlockStore.save(update.data as ContextBlock);
          }
          break;

        case 'run':
          if (update.type === 'deleted') {
            await indexedDb.runStore.delete(update.resourceId);
          } else if (update.data) {
            await indexedDb.runStore.save(update.data as Run);
          }
          break;

        case 'promptTemplate':
          if (update.type === 'deleted') {
            await indexedDb.promptTemplateStore.delete(update.resourceId);
          } else if (update.data) {
            await indexedDb.promptTemplateStore.save(update.data as PromptTemplate);
          }
          break;
      }

      // Update sync metadata
      await indexedDb.syncMetadataStore.save({
        id: `${update.resourceType}:${update.resourceId}`,
        resourceType: update.resourceType,
        lastSyncedAt: update.timestamp,
        localVersion: 1,
        serverVersion: 1,
        isPending: false,
        hasConflict: false,
      });

      // Notify handlers
      this.notifyHandlers(update);

      // Broadcast to other tabs
      if (this.broadcast) {
        this.broadcast.postMessage({ type: 'resource_update', update });
      }
    } catch (error) {
      console.error('[WebSocket] Failed to handle resource update:', error);
    }
  }

  private notifyHandlers(update: ResourceUpdate): void {
    for (const handler of this.handlers) {
      try {
        handler(update);
      } catch (error) {
        console.error('[WebSocket] Handler error:', error);
      }
    }
  }

  private send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ event: 'ping' });
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WebSocket] Reconnection failed:', error);
      });
    }, delay);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let wsInstance: WebSocketSync | null = null;

export function getWebSocketSync(): WebSocketSync {
  if (!wsInstance) {
    wsInstance = new WebSocketSync();
  }
  return wsInstance;
}

export function initWebSocketSync(): WebSocketSync {
  const ws = getWebSocketSync();
  ws.connect().catch((error) => {
    console.error('[WebSocket] Failed to connect:', error);
  });
  return ws;
}
