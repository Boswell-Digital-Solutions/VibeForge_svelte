/**
 * WebSocket Client - Phase 4.4
 * Manages WebSocket connections for real-time streaming inference
 */

import type {
  StreamEvent,
  WebSocketConfig,
  WebSocketState,
  StreamEventHandlers,
  ConnectionStatus,
} from '$lib/types/streaming';
import { parseStreamEvent } from '$lib/types/streaming';
import { NEUROFORGE_WS_URL } from '$lib/core/api/endpoints';

const WS_BASE_URL = NEUROFORGE_WS_URL;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private state: WebSocketState;
  private handlers: StreamEventHandlers;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig, handlers: StreamEventHandlers = {}) {
    this.config = {
      reconnect: true,
      reconnect_interval: 3000,
      max_reconnect_attempts: 5,
      ...config,
    };

    this.state = {
      status: 'connecting',
      connected_at: null,
      disconnected_at: null,
      error: null,
      reconnect_attempts: 0,
    };

    this.handlers = handlers;
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('WebSocket already connected');
      return;
    }

    try {
      // Build WebSocket URL
      const url = this.buildWebSocketUrl();
      console.log(`Connecting to WebSocket: ${url}`);

      this.updateStatus('connecting');
      this.ws = new WebSocket(url);

      // Set up event listeners
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.state.error = error instanceof Error ? error : new Error(String(error));
      this.updateStatus('error');
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    console.log('Disconnecting WebSocket');

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.updateStatus('disconnected');
  }

  /**
   * Send cancellation message
   */
  public cancel(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot cancel: WebSocket not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type: 'cancel' }));
      console.log('Cancellation message sent');
    } catch (error) {
      console.error('Failed to send cancellation:', error);
    }
  }

  /**
   * Send ping message
   */
  public ping(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    } catch (error) {
      console.error('Failed to send ping:', error);
    }
  }

  /**
   * Get current connection status
   */
  public getStatus(): ConnectionStatus {
    return this.state.status;
  }

  /**
   * Get connection state
   */
  public getState(): WebSocketState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.state.status === 'connected';
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildWebSocketUrl(): string {
    const { url, inference_id, user_id } = this.config;

    // If full URL provided, use it
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url;
    }

    // Otherwise, build URL from base + inference_id
    let wsUrl = `${WS_BASE_URL}/api/v1/ws/stream/${inference_id}`;

    if (user_id) {
      wsUrl += `?user_id=${encodeURIComponent(user_id)}`;
    }

    return wsUrl;
  }

  private handleOpen(event: Event): void {
    console.log('WebSocket connected');

    this.state.connected_at = new Date();
    this.state.reconnect_attempts = 0;
    this.updateStatus('connected');

    // Start heartbeat
    this.startHeartbeat();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const streamEvent = parseStreamEvent(data);

      if (!streamEvent) {
        console.warn('Invalid stream event:', data);
        return;
      }

      // Route to appropriate handler
      this.routeEvent(streamEvent);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleError(event: Event): void {
    console.error('WebSocket error:', event);

    this.state.error = new Error('WebSocket connection error');
    this.updateStatus('error');
  }

  private handleClose(event: CloseEvent): void {
    console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);

    this.state.disconnected_at = new Date();
    this.updateStatus('disconnected');

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Attempt reconnection if enabled
    if (this.config.reconnect && this.shouldReconnect(event.code)) {
      this.attemptReconnect();
    }
  }

  private routeEvent(event: StreamEvent): void {
    // Call general event handler if provided
    if (this.handlers.onConnectionChange && event.type === 'connected') {
      this.handlers.onConnectionChange('connected');
    }

    // Call specific event handler
    switch (event.type) {
      case 'connected':
        this.handlers.onConnected?.(event as any);
        break;
      case 'progress':
        this.handlers.onProgress?.(event as any);
        break;
      case 'chunk':
        this.handlers.onChunk?.(event as any);
        break;
      case 'stage_start':
        this.handlers.onStageStart?.(event as any);
        break;
      case 'stage_complete':
        this.handlers.onStageComplete?.(event as any);
        break;
      case 'complete':
        this.handlers.onComplete?.(event as any);
        break;
      case 'error':
        this.handlers.onError?.(event as any);
        break;
      case 'cancelled':
        this.handlers.onCancelled?.(event as any);
        break;
      case 'heartbeat':
        this.handlers.onHeartbeat?.(event as any);
        break;
    }
  }

  private updateStatus(status: ConnectionStatus): void {
    this.state.status = status;
    this.handlers.onConnectionChange?.(status);
  }

  private shouldReconnect(closeCode: number): boolean {
    // Don't reconnect on normal closure or client-initiated disconnect
    if (closeCode === 1000 || closeCode === 1001) {
      return false;
    }

    // Check reconnect attempts
    if (
      this.config.max_reconnect_attempts &&
      this.state.reconnect_attempts >= this.config.max_reconnect_attempts
    ) {
      console.warn('Max reconnect attempts reached');
      return false;
    }

    return true;
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already attempting reconnect
    }

    this.state.reconnect_attempts++;
    const delay = this.config.reconnect_interval || 3000;

    console.log(
      `Attempting reconnect in ${delay}ms (attempt ${this.state.reconnect_attempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    // Send ping every 30 seconds
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, 30000);
  }
}

/**
 * Create a WebSocket client for streaming inference
 */
export function createWebSocketClient(
  inference_id: string,
  handlers: StreamEventHandlers,
  user_id?: string
): WebSocketClient {
  const config: WebSocketConfig = {
    url: '', // Will be built from base URL
    inference_id,
    user_id,
  };

  return new WebSocketClient(config, handlers);
}
