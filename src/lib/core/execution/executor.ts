/**
 * VibeForge V2 - Execution Orchestrator
 *
 * Orchestrates parallel prompt execution across multiple LLM providers with streaming support.
 */

import type { Model } from '$lib/core/types';
import type { LLMCompletionRequest, LLMCompletionResponse } from '$lib/core/llm/types';
import { llmManager } from '$lib/core/llm/manager';
import { ContextBuilder } from './contextBuilder';
import { TemplateProcessor } from './templateProcessor';
import type {
  ExecutionRequest,
  ExecutionResult,
  ExecutionOptions,
  ExecutionProgress,
  StreamEvent,
  StreamEventType,
} from './types';

// ============================================================================
// EXECUTION ORCHESTRATOR
// ============================================================================

export class ExecutionOrchestrator {
  /**
   * Execute prompt across multiple models
   */
  static async execute(
    request: ExecutionRequest,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult[]> {
    const {
      stream = true,
      parallel = true,
      maxTokens = 4096,
      temperature = 0.7,
      abortSignal,
      onStreamEvent,
      onProgress,
    } = options;

    // Validate request
    this.validateRequest(request);

    // Process template variables
    const processedPrompt = request.variables
      ? TemplateProcessor.process(request.prompt, request.variables).resolved
      : request.prompt;

    // Build execution context
    const context = ContextBuilder.build(
      processedPrompt,
      request.contextBlocks,
      request.toolResults || []
    );

    // Validate context
    const validation = ContextBuilder.validate(context);
    if (!validation.valid) {
      throw new Error(`Invalid execution context: ${validation.errors.join(', ')}`);
    }

    // Execute across models
    if (parallel) {
      return this.executeParallel(
        request.models,
        context.messages,
        {
          stream,
          maxTokens,
          temperature,
          abortSignal,
          onStreamEvent,
          onProgress,
        }
      );
    } else {
      return this.executeSequential(
        request.models,
        context.messages,
        {
          stream,
          maxTokens,
          temperature,
          abortSignal,
          onStreamEvent,
          onProgress,
        }
      );
    }
  }

  /**
   * Execute models in parallel
   */
  private static async executeParallel(
    models: Model[],
    messages: Array<{ role: string; content: string }>,
    options: {
      stream: boolean;
      maxTokens: number;
      temperature: number;
      abortSignal?: AbortSignal;
      onStreamEvent?: (event: StreamEvent) => void;
      onProgress?: (progress: ExecutionProgress) => void;
    }
  ): Promise<ExecutionResult[]> {
    const { onProgress } = options;

    // Track progress
    let completed = 0;
    let failed = 0;

    // Report initial progress
    onProgress?.({
      total: models.length,
      completed: 0,
      failed: 0,
      running: models.length,
      percentage: 0,
    });

    // Execute all models in parallel
    const promises = models.map(async (model) => {
      try {
        const result = await this.executeSingle(model, messages, options);

        completed++;
        onProgress?.({
          total: models.length,
          completed,
          failed,
          running: models.length - completed - failed,
          percentage: Math.round((completed / models.length) * 100),
        });

        return result;
      } catch (error) {
        failed++;
        onProgress?.({
          total: models.length,
          completed,
          failed,
          running: models.length - completed - failed,
          percentage: Math.round((completed / models.length) * 100),
        });

        // Return error result
        return this.createErrorResult(
          model,
          error instanceof Error ? error.message : 'Execution failed'
        );
      }
    });

    return Promise.all(promises);
  }

  /**
   * Execute models sequentially
   */
  private static async executeSequential(
    models: Model[],
    messages: Array<{ role: string; content: string }>,
    options: {
      stream: boolean;
      maxTokens: number;
      temperature: number;
      abortSignal?: AbortSignal;
      onStreamEvent?: (event: StreamEvent) => void;
      onProgress?: (progress: ExecutionProgress) => void;
    }
  ): Promise<ExecutionResult[]> {
    const { onProgress } = options;
    const results: ExecutionResult[] = [];
    let completed = 0;
    let failed = 0;

    for (const model of models) {
      // Check for abort
      if (options.abortSignal?.aborted) {
        break;
      }

      // Report progress
      onProgress?.({
        total: models.length,
        completed,
        failed,
        running: 1,
        percentage: Math.round((completed / models.length) * 100),
      });

      try {
        const result = await this.executeSingle(model, messages, options);
        results.push(result);
        completed++;
      } catch (error) {
        failed++;
        results.push(
          this.createErrorResult(
            model,
            error instanceof Error ? error.message : 'Execution failed'
          )
        );
      }
    }

    // Final progress
    onProgress?.({
      total: models.length,
      completed,
      failed,
      running: 0,
      percentage: 100,
    });

    return results;
  }

  /**
   * Execute a single model
   */
  private static async executeSingle(
    model: Model,
    messages: Array<{ role: string; content: string }>,
    options: {
      stream: boolean;
      maxTokens: number;
      temperature: number;
      abortSignal?: AbortSignal;
      onStreamEvent?: (event: StreamEvent) => void;
    }
  ): Promise<ExecutionResult> {
    const { stream, maxTokens, temperature, abortSignal, onStreamEvent } = options;

    const startedAt = new Date().toISOString();
    const runId = this.generateRunId();

    // Emit start event
    if (stream && onStreamEvent) {
      onStreamEvent(this.createStreamEvent('start', runId, model.id, {
        type: 'start',
        runId,
        modelId: model.id,
      }));
    }

    try {
      // Get provider. ModelProvider also admits 'neuroforge', which is routed
      // by NeuroForge rather than constructed here, so refuse it explicitly.
      if (model.provider === 'neuroforge') {
        throw new Error(
          `Model ${model.id} routes through NeuroForge; this executor cannot call it directly`
        );
      }
      const provider = llmManager.getProvider(model.provider);

      // Build completion request
      const completionRequest: LLMCompletionRequest = {
        model: model.id,
        messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
        maxTokens,
        temperature,
        stream,
      };

      let response: LLMCompletionResponse;

      if (stream) {
        // Streaming execution
        let output = '';
        let tokenIndex = 0;

        let streamed: LLMCompletionResponse | null = null;

        await provider.completeStream(completionRequest, {
          onChunk: (chunk) => {
            output += chunk.content;
            onStreamEvent?.(
              this.createStreamEvent('token', runId, model.id, {
                type: 'token',
                token: chunk.content,
                index: tokenIndex++,
              })
            );
          },
          onComplete: (completed) => {
            streamed = completed;
          },
        });

        // Read through an annotated alias: the assignment happens in a callback,
        // which narrowing cannot see.
        const streamedResponse = streamed as LLMCompletionResponse | null;
        if (!streamedResponse) {
          throw new Error(`Streaming completion returned no response for ${model.id}`);
        }
        response = streamedResponse;
      } else {
        // Non-streaming execution
        response = await provider.complete(completionRequest);
      }

      const completedAt = new Date().toISOString();
      const durationMs =
        new Date(completedAt).getTime() - new Date(startedAt).getTime();

      // Emit complete event
      if (stream && onStreamEvent) {
        onStreamEvent(
          this.createStreamEvent('complete', runId, model.id, {
            type: 'complete',
            output: response.content,
            usage: response.usage,
            finishReason: response.finishReason,
          })
        );
      }

      // Return execution result
      return {
        runId,
        model,
        status: 'success',
        output: response.content,
        usage: response.usage,
        durationMs,
        startedAt,
        completedAt,
        finishReason: response.finishReason,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Emit error event
      if (stream && onStreamEvent) {
        onStreamEvent(
          this.createStreamEvent('error', runId, model.id, {
            type: 'error',
            error: errorMessage,
          })
        );
      }

      throw error;
    }
  }

  /**
   * Create an error result
   */
  private static createErrorResult(model: Model, error: string): ExecutionResult {
    return {
      runId: this.generateRunId(),
      model,
      status: 'error',
      output: '',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      durationMs: 0,
      startedAt: new Date().toISOString(),
      error,
    };
  }

  /**
   * Create a stream event
   */
  private static createStreamEvent(
    type: StreamEventType,
    runId: string,
    modelId: string,
    data: any
  ): StreamEvent {
    return {
      type,
      runId,
      modelId,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Generate a unique run ID
   */
  private static generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Validate execution request
   */
  private static validateRequest(request: ExecutionRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt is required');
    }

    if (!request.models || request.models.length === 0) {
      throw new Error('At least one model is required');
    }

    // Validate template variables if present
    if (request.variables) {
      const validation = TemplateProcessor.validateVariables(
        request.prompt,
        request.variables
      );
      if (!validation.valid) {
        throw new Error(`Invalid variables: ${validation.errors.join(', ')}`);
      }
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Execute a simple prompt with a single model
 */
export async function executeSimple(
  prompt: string,
  model: Model,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const results = await ExecutionOrchestrator.execute(
    {
      prompt,
      models: [model],
      contextBlocks: [],
    },
    options
  );

  return results[0];
}

/**
 * Execute with context blocks
 */
export async function executeWithContext(
  request: ExecutionRequest,
  options?: ExecutionOptions
): Promise<ExecutionResult[]> {
  return ExecutionOrchestrator.execute(request, options);
}
