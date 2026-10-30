/**
 * Model Router Service for Cortex Planning
 * Unified client for calling multiple LLM providers with streaming
 */

import type {
	Provider,
	ModelCallOptions,
	ModelCallResult
} from '$lib/workbench/planning/types';

// ==============================================================================
// PROVIDER CONFIGURATIONS
// ==============================================================================

/**
 * Model pricing (per 1M tokens)
 */
const MODEL_PRICING: Record<
	string,
	{ input: number; output: number; provider: Provider }
> = {
	// Anthropic Claude
	'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0, provider: 'anthropic' },
	'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0, provider: 'anthropic' },
	'claude-3-opus-20240229': { input: 15.0, output: 75.0, provider: 'anthropic' },

	// OpenAI GPT-4
	'gpt-4-turbo-2024-04-09': { input: 10.0, output: 30.0, provider: 'openai' },
	'gpt-4-0125-preview': { input: 10.0, output: 30.0, provider: 'openai' },
	'gpt-4': { input: 30.0, output: 60.0, provider: 'openai' },
	'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5, provider: 'openai' },

	// xAI Grok
	'grok-beta': { input: 5.0, output: 15.0, provider: 'xai' },
	'grok-1': { input: 5.0, output: 15.0, provider: 'xai' },

	// Google Gemini
	'gemini-1.5-pro': { input: 3.5, output: 10.5, provider: 'google' },
	'gemini-1.5-flash': { input: 0.35, output: 1.05, provider: 'google' }
};

/**
 * Provider API endpoints
 */
const PROVIDER_ENDPOINTS: Record<Provider, string> = {
	anthropic: 'https://api.anthropic.com/v1/messages',
	openai: 'https://api.openai.com/v1/chat/completions',
	xai: 'https://api.x.ai/v1/chat/completions',
	google: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// ==============================================================================
// MODEL ROUTER CLASS
// ==============================================================================

export class ModelRouter {
	private abortController: AbortController | null = null;
	private apiKeys: Record<Provider, string> = {
		anthropic: '',
		openai: '',
		xai: '',
		google: ''
	};

	/**
	 * Set API key for a provider
	 */
	setApiKey(provider: Provider, apiKey: string) {
		this.apiKeys[provider] = apiKey;
	}

	/**
	 * Get API key for a provider
	 */
	private getApiKey(provider: Provider): string {
		const apiKey = this.apiKeys[provider];
		if (!apiKey) {
			throw new Error(`API key not set for provider: ${provider}`);
		}
		return apiKey;
	}

	/**
	 * Call an LLM with the given options
	 */
	async call(options: ModelCallOptions): Promise<ModelCallResult> {
		const startTime = Date.now();

		// Create abort controller for this request
		this.abortController = new AbortController();
		const signal = options.signal || this.abortController.signal;

		try {
			// Build request based on provider
			const { request, headers } = this.buildRequest(options);

			// Make the API call
			const response = await fetch(
				this.getEndpoint(options.provider, options.model),
				{
					method: 'POST',
					headers,
					body: JSON.stringify(request),
					signal
				}
			);

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`API error (${response.status}): ${error}`);
			}

			// Handle streaming or non-streaming
			if (options.onProgress) {
				return await this.handleStreamingResponse(
					response,
					options,
					startTime
				);
			} else {
				return await this.handleNonStreamingResponse(
					response,
					options,
					startTime
				);
			}
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error('Request was cancelled');
			}
			throw error;
		} finally {
			this.abortController = null;
		}
	}

	/**
	 * Abort the current request
	 */
	abort() {
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}
	}

	/**
	 * Build request payload for the given provider
	 */
	private buildRequest(options: ModelCallOptions): {
		request: any;
		headers: Record<string, string>;
	} {
		const { provider, model, prompt, systemPrompt, maxTokens, temperature } = options;

		if (provider === 'anthropic') {
			return {
				request: {
					model,
					messages: [{ role: 'user', content: prompt }],
					...(systemPrompt && { system: systemPrompt }),
					max_tokens: maxTokens || 4000,
					temperature: temperature ?? 0.7,
					stream: !!options.onProgress
				},
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.getApiKey(provider),
					'anthropic-version': '2023-06-01'
				}
			};
		}

		if (provider === 'openai' || provider === 'xai') {
			const messages: any[] = [];
			if (systemPrompt) {
				messages.push({ role: 'system', content: systemPrompt });
			}
			messages.push({ role: 'user', content: prompt });

			return {
				request: {
					model,
					messages,
					max_tokens: maxTokens || 4000,
					temperature: temperature ?? 0.7,
					stream: !!options.onProgress
				},
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.getApiKey(provider)}`
				}
			};
		}

		if (provider === 'google') {
			return {
				request: {
					contents: [
						{
							parts: [
								{
									text: systemPrompt
										? `${systemPrompt}\n\n${prompt}`
										: prompt
								}
							]
						}
					],
					generationConfig: {
						maxOutputTokens: maxTokens || 4000,
						temperature: temperature ?? 0.7
					}
				},
				headers: {
					'Content-Type': 'application/json'
				}
			};
		}

		throw new Error(`Unsupported provider: ${provider}`);
	}

	/**
	 * Get API endpoint for provider
	 */
	private getEndpoint(provider: Provider, model: string): string {
		if (provider === 'google') {
			const apiKey = this.getApiKey(provider);
			return `${PROVIDER_ENDPOINTS[provider]}/${model}:generateContent?key=${apiKey}`;
		}
		return PROVIDER_ENDPOINTS[provider];
	}

	/**
	 * Handle non-streaming response
	 */
	private async handleNonStreamingResponse(
		response: Response,
		options: ModelCallOptions,
		startTime: number
	): Promise<ModelCallResult> {
		const data = await response.json();
		const durationMs = Date.now() - startTime;

		const { content, tokensUsed } = this.parseResponse(data, options.provider);
		const cost = this.calculateCost(options.model, tokensUsed);

		return {
			content,
			tokensUsed,
			cost,
			model: options.model,
			provider: options.provider,
			durationMs,
			finishReason: 'stop'
		};
	}

	/**
	 * Handle streaming response
	 */
	private async handleStreamingResponse(
		response: Response,
		options: ModelCallOptions,
		startTime: number
	): Promise<ModelCallResult> {
		if (!response.body) {
			throw new Error('Response body is null');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullContent = '';
		let promptTokens = 0;
		let completionTokens = 0;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n').filter((line) => line.trim() !== '');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') continue;

						try {
							const parsed = JSON.parse(data);
							const token = this.extractTokenFromChunk(parsed, options.provider);

							if (token) {
								fullContent += token;
								options.onProgress?.(token);
							}

							// Extract token counts if available
							if (parsed.usage) {
								promptTokens = parsed.usage.prompt_tokens || 0;
								completionTokens = parsed.usage.completion_tokens || 0;
							}
						} catch (e) {
							// Skip invalid JSON
							console.warn('Failed to parse SSE chunk:', e);
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		const durationMs = Date.now() - startTime;

		// If we didn't get token counts from streaming, estimate them
		if (promptTokens === 0) {
			promptTokens = this.estimateTokens(
				options.systemPrompt || '' + options.prompt
			);
		}
		if (completionTokens === 0) {
			completionTokens = this.estimateTokens(fullContent);
		}

		const tokensUsed = {
			prompt: promptTokens,
			completion: completionTokens,
			total: promptTokens + completionTokens
		};

		const cost = this.calculateCost(options.model, tokensUsed);

		return {
			content: fullContent,
			tokensUsed,
			cost,
			model: options.model,
			provider: options.provider,
			durationMs,
			finishReason: 'stop'
		};
	}

	/**
	 * Parse response based on provider
	 */
	private parseResponse(
		data: any,
		provider: Provider
	): {
		content: string;
		tokensUsed: { prompt: number; completion: number; total: number };
	} {
		if (provider === 'anthropic') {
			return {
				content: data.content[0].text,
				tokensUsed: {
					prompt: data.usage.input_tokens,
					completion: data.usage.output_tokens,
					total: data.usage.input_tokens + data.usage.output_tokens
				}
			};
		}

		if (provider === 'openai' || provider === 'xai') {
			return {
				content: data.choices[0].message.content,
				tokensUsed: {
					prompt: data.usage.prompt_tokens,
					completion: data.usage.completion_tokens,
					total: data.usage.total_tokens
				}
			};
		}

		if (provider === 'google') {
			return {
				content: data.candidates[0].content.parts[0].text,
				tokensUsed: {
					prompt: data.usageMetadata?.promptTokenCount || 0,
					completion: data.usageMetadata?.candidatesTokenCount || 0,
					total: data.usageMetadata?.totalTokenCount || 0
				}
			};
		}

		throw new Error(`Unsupported provider: ${provider}`);
	}

	/**
	 * Extract token from streaming chunk
	 */
	private extractTokenFromChunk(chunk: any, provider: Provider): string | null {
		if (provider === 'anthropic') {
			if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
				return chunk.delta.text;
			}
		}

		if (provider === 'openai' || provider === 'xai') {
			return chunk.choices?.[0]?.delta?.content || null;
		}

		if (provider === 'google') {
			return chunk.candidates?.[0]?.content?.parts?.[0]?.text || null;
		}

		return null;
	}

	/**
	 * Calculate cost based on token usage
	 */
	calculateCost(
		model: string,
		tokensUsed: { prompt: number; completion: number; total: number }
	): number {
		const pricing = MODEL_PRICING[model];
		if (!pricing) {
			console.warn(`No pricing data for model: ${model}`);
			return 0;
		}

		const inputCost = (tokensUsed.prompt / 1_000_000) * pricing.input;
		const outputCost = (tokensUsed.completion / 1_000_000) * pricing.output;

		return inputCost + outputCost;
	}

	/**
	 * Estimate tokens (rough approximation: 1 token ≈ 4 characters)
	 */
	private estimateTokens(text: string): number {
		return Math.ceil(text.length / 4);
	}
}

// ==============================================================================
// SINGLETON INSTANCE
// ==============================================================================

export const modelRouter = new ModelRouter();
