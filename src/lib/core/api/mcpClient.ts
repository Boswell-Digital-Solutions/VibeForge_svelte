/**
 * VibeForge V2 - MCP Client
 *
 * This client implements the Model Context Protocol for discovering and invoking tools.
 * Phase 2: Real MCP protocol implementation with fallback to mock data.
 *
 * MCP Flow:
 * 1. listServers() - Discover available MCP servers
 * 2. listTools(serverId) - List tools provided by a server
 * 3. invokeTool(serverId, toolName, args) - Execute a tool
 */

import type {
  McpServer,
  McpTool,
  McpToolInvocation,
  ListServersRequest,
  ListServersResponse,
  ListToolsRequest,
  ListToolsResponse,
  InvokeToolRequest,
  InvokeToolResponse,
} from '$lib/core/types';
import { mcpManager } from '$lib/core/mcp/manager';
import type {
  McpTool as McpProtocolTool,
  McpConnectionStatus,
  McpSchemaProperty as McpProtocolSchemaProperty,
} from '$lib/core/mcp/types';
import type {
  McpServerStatus,
  McpSchemaProperty,
  McpToolInputSchema,
} from '$lib/core/types';
import { DATAFORGE_URL, NEUROFORGE_URL } from './endpoints';

// ============================================================================
// PROTOCOL -> DOMAIN CONVERSION
// ============================================================================
// The protocol types in $lib/core/mcp/types are deliberately wider than the
// domain types here, so each crossing narrows explicitly rather than casting.

/** The protocol models a 'connecting' state the domain status does not. */
function toServerStatus(status: McpConnectionStatus): McpServerStatus {
  return status === 'connecting' ? 'disconnected' : status;
}

const SCHEMA_TYPES: readonly string[] = [
  'string',
  'number',
  'boolean',
  'array',
  'object',
];

/** The protocol types a property as a bare string; narrow it to the union. */
function toSchemaProperty(
  property: McpProtocolSchemaProperty
): McpSchemaProperty {
  return {
    type: SCHEMA_TYPES.includes(property.type)
      ? (property.type as McpSchemaProperty['type'])
      : 'string',
    description: property.description,
    enum: property.enum,
    items: property.items ? toSchemaProperty(property.items) : undefined,
  };
}

function toInputSchema(
  schema: McpProtocolTool['inputSchema']
): McpToolInputSchema {
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        toSchemaProperty(value),
      ])
    ),
    required: schema.required,
  };
}

// Flag to enable real MCP or use mock data
const USE_REAL_MCP = true;

// ============================================================================
// SERVER DISCOVERY
// ============================================================================

export async function listServers(
  request: ListServersRequest = {}
): Promise<ListServersResponse> {
  if (USE_REAL_MCP) {
    // Get managed servers from MCP manager
    const managedServers = mcpManager.listServers({
      includeDisconnected: request.includeDisconnected
    });

    // Convert to VibeForge McpServer format
    const servers: McpServer[] = managedServers.map(server => {
      const serverInfo = mcpManager.getServerInfo(server.id);

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        version: serverInfo?.version || '1.0.0',
        status: toServerStatus(server.status),
        endpoint: server.config.url || '',
        capabilities: {
          supportsToolDiscovery: serverInfo?.capabilities?.tools?.list ?? true,
          supportsStreaming: false, // WebSocket streaming not yet implemented
          supportsAuth: true,
        },
      };
    });

    return { servers };
  }

  // Fallback to mock data
  await delay(300);

  const servers: McpServer[] = [
    {
      id: 'mcp_dataforge',
      name: 'DataForge MCP',
      description: 'Knowledge base queries and context management',
      version: '1.0.0',
      status: 'connected',
      endpoint: `${DATAFORGE_URL}/mcp`,
      capabilities: {
        supportsToolDiscovery: true,
        supportsStreaming: false,
        supportsAuth: true,
      },
    },
    {
      id: 'mcp_neuroforge',
      name: 'NeuroForge MCP',
      description: 'Model routing and execution',
      version: '1.0.0',
      status: 'connected',
      endpoint: `${NEUROFORGE_URL}/mcp`,
      capabilities: {
        supportsToolDiscovery: true,
        supportsStreaming: true,
        supportsAuth: true,
      },
    },
  ];

  const filtered = request.includeDisconnected
    ? servers
    : servers.filter((s) => s.status === 'connected');

  return {
    servers: filtered,
  };
}

// ============================================================================
// TOOL DISCOVERY
// ============================================================================

// Helper function to convert MCP protocol tool to VibeForge McpTool
function convertProtocolTool(protocolTool: McpProtocolTool, serverId: string): McpTool {
  return {
    id: `${serverId}_${protocolTool.name}`,
    serverId,
    name: protocolTool.name,
    description: protocolTool.description,
    category: inferToolCategory(protocolTool.name),
    inputSchema: toInputSchema(protocolTool.inputSchema),
    isFavorite: false,
  };
}

// Infer tool category from name
function inferToolCategory(toolName: string): 'query' | 'generate' | 'transform' | 'analyze' {
  const lower = toolName.toLowerCase();
  if (lower.includes('query') || lower.includes('search') || lower.includes('get')) {
    return 'query';
  }
  if (lower.includes('generate') || lower.includes('create') || lower.includes('execute')) {
    return 'generate';
  }
  if (lower.includes('analyze') || lower.includes('route')) {
    return 'analyze';
  }
  return 'transform';
}

export async function listTools(request: ListToolsRequest): Promise<ListToolsResponse> {
  if (USE_REAL_MCP) {
    // Get tools from MCP manager
    const protocolTools = mcpManager.listTools(request.serverId);

    // Convert to VibeForge format
    const tools = protocolTools.map(tool =>
      convertProtocolTool(tool, request.serverId)
    );

    // Filter by category if requested
    const filtered = request.category
      ? tools.filter((t) => t.category === request.category)
      : tools;

    return { tools: filtered };
  }

  // Fallback to mock data
  await delay(300);

  const toolsByServer: Record<string, McpTool[]> = {
    mcp_dataforge: [
      {
        id: 'tool_query_kb',
        serverId: 'mcp_dataforge',
        name: 'queryKnowledgeBase',
        description: 'Search the knowledge base using vector similarity',
        category: 'query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
            },
            workspaceId: {
              type: 'string',
              description: 'Optional workspace ID to filter results',
            },
          },
          required: ['query'],
        },
        examples: [
          {
            input: { query: 'Svelte 5 runes', limit: 5 },
            output: { results: ['...'], count: 3 },
            description: 'Search for Svelte 5 documentation',
          },
        ],
        isFavorite: false,
      },
      {
        id: 'tool_get_context',
        serverId: 'mcp_dataforge',
        name: 'getContextBlock',
        description: 'Retrieve a specific context block by ID',
        category: 'query',
        inputSchema: {
          type: 'object',
          properties: {
            contextId: {
              type: 'string',
              description: 'Context block ID',
            },
          },
          required: ['contextId'],
        },
        isFavorite: false,
      },
      {
        id: 'tool_ingest_doc',
        serverId: 'mcp_dataforge',
        name: 'ingestDocument',
        description: 'Ingest and index a new document',
        category: 'transform',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Document content',
            },
            title: {
              type: 'string',
              description: 'Document title',
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
            },
          },
          required: ['content', 'title'],
        },
        isFavorite: false,
      },
    ],
    mcp_neuroforge: [
      {
        id: 'tool_route_model',
        serverId: 'mcp_neuroforge',
        name: 'routeToModel',
        description: 'Route a prompt to the best available model',
        category: 'analyze',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to execute',
            },
            constraints: {
              type: 'object',
              description: 'Routing constraints (cost, speed, quality)',
            },
          },
          required: ['prompt'],
        },
        isFavorite: true,
      },
      {
        id: 'tool_exec_prompt',
        serverId: 'mcp_neuroforge',
        name: 'executePrompt',
        description: 'Execute a prompt on specified models',
        category: 'generate',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The prompt to execute',
            },
            modelIds: {
              type: 'array',
              description: 'List of model IDs',
              items: {
                type: 'string',
              },
            },
            stream: {
              type: 'boolean',
              description: 'Enable streaming responses',
            },
          },
          required: ['prompt', 'modelIds'],
        },
        isFavorite: true,
      },
    ],
    mcp_web: [
      {
        id: 'tool_web_search',
        serverId: 'mcp_web',
        name: 'webSearch',
        description: 'Search the web and return results',
        category: 'query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum results to return',
            },
          },
          required: ['query'],
        },
        isFavorite: false,
      },
    ],
  };

  const tools = toolsByServer[request.serverId] || [];

  const filtered = request.category
    ? tools.filter((t) => t.category === request.category)
    : tools;

  return {
    tools: filtered,
  };
}

// ============================================================================
// TOOL INVOCATION
// ============================================================================

export async function invokeTool(
  request: InvokeToolRequest
): Promise<InvokeToolResponse> {
  const startedAt = new Date().toISOString();

  if (USE_REAL_MCP) {
    try {
      const startTime = Date.now();

      // Call the real MCP tool
      const result = await mcpManager.callTool(
        request.serverId,
        request.toolName,
        request.args
      );

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      const invocation: McpToolInvocation = {
        id: `inv_${Date.now()}`,
        toolId: `${request.serverId}_${request.toolName}`,
        serverId: request.serverId,
        args: request.args,
        status: 'success',
        startedAt,
        completedAt,
        durationMs,
        result: {
          data: result,
          metadata: {
            source: 'mcp',
            phase: 2,
          },
        },
      };

      return { invocation };
    } catch (error) {
      // Handle tool invocation error
      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - new Date(startedAt).getTime();

      const invocation: McpToolInvocation = {
        id: `inv_${Date.now()}`,
        toolId: `${request.serverId}_${request.toolName}`,
        serverId: request.serverId,
        args: request.args,
        status: 'error',
        startedAt,
        completedAt,
        durationMs,
        error: {
          code: 'invocation_failed',
          message: error instanceof Error ? error.message : String(error),
        },
      };

      return { invocation };
    }
  }

  // Fallback to mock data
  await delay(1000 + Math.random() * 500);

  const invocation: McpToolInvocation = {
    id: `inv_${Date.now()}`,
    toolId: `tool_${request.toolName}`,
    serverId: request.serverId,
    args: request.args,
    status: 'success',
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: 1200,
    result: {
      data: generateMockToolResult(request.toolName, request.args),
      metadata: {
        source: 'mock',
        phase: 1,
      },
    },
  };

  return {
    invocation,
  };
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Initialize MCP connections to all registered servers
 * Call this when the app starts to establish connections
 */
export async function initializeMcpConnections(): Promise<void> {
  if (!USE_REAL_MCP) {
    return;
  }

  try {
    await mcpManager.connectAll();
  } catch (error) {
    console.error('Failed to initialize MCP connections:', error);
    // Don't throw - we'll fall back to mock data
  }
}

/**
 * Connect to a specific MCP server
 */
export async function connectToServer(serverId: string): Promise<void> {
  if (!USE_REAL_MCP) {
    return;
  }

  await mcpManager.connectServer(serverId);
}

/**
 * Disconnect from a specific MCP server
 */
export async function disconnectFromServer(serverId: string): Promise<void> {
  if (!USE_REAL_MCP) {
    return;
  }

  await mcpManager.disconnectServer(serverId);
}

/**
 * Get the MCP manager instance for advanced usage
 */
export function getMcpManager() {
  return mcpManager;
}

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMockToolResult(toolName: string, args: Record<string, unknown>): unknown {
  // Generate contextual mock data based on tool name
  switch (toolName) {
    case 'queryKnowledgeBase':
      return {
        results: [
          {
            id: 'ctx_svelte5',
            title: 'Svelte 5 Runes',
            relevance: 0.92,
            snippet: 'Svelte 5 introduces runes for reactivity: $state, $derived...',
          },
        ],
        count: 1,
        query: args.query,
      };

    case 'getContextBlock':
      return {
        id: args.contextId,
        title: 'Mock Context Block',
        content: 'This is mock content for demonstration',
      };

    case 'routeToModel':
      return {
        recommendedModel: 'claude-3.5-sonnet',
        reasoning: 'Best balance of quality and cost for this prompt type',
        alternatives: ['gpt-4o', 'claude-3.5-haiku'],
      };

    case 'executePrompt':
      return {
        outputs: (args.modelIds as string[]).map((modelId) => ({
          modelId,
          response: `Mock response from ${modelId}`,
          tokens: 250,
        })),
      };

    case 'webSearch':
      return {
        results: [
          {
            title: 'Mock Search Result',
            url: 'https://example.com',
            snippet: 'This is a mock search result for demonstration purposes',
          },
        ],
        query: args.query,
      };

    default:
      return {
        message: 'Mock tool result',
        args,
      };
  }
}
