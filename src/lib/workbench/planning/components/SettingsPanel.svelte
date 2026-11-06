<!--
  Settings Panel Component
  Configure API keys for planning orchestrator providers
-->
<script lang="ts">
	import { planningStore } from '$lib/workbench/planning/stores/planning.svelte';
	import type { Provider } from '$lib/workbench/planning/types';

	// ========================================================================
	// STATE
	// ========================================================================

	let apiKeys = $state<Record<Provider, string>>({
		anthropic: '',
		openai: '',
		xai: '',
		google: ''
	});

	let savedKeys = $state<Record<Provider, boolean>>({
		anthropic: false,
		openai: false,
		xai: false,
		google: false
	});

	let showKeys = $state<Record<Provider, boolean>>({
		anthropic: false,
		openai: false,
		xai: false,
		google: false
	});

	let saveStatus = $state<string | null>(null);

	// ========================================================================
	// LIFECYCLE
	// ========================================================================

	// Load API keys from localStorage on mount
	$effect(() => {
		const stored = localStorage.getItem('vibeforge-planning-api-keys');
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				Object.keys(parsed).forEach((provider) => {
					if (parsed[provider]) {
						savedKeys[provider as Provider] = true;
						// Don't display the actual key, just show it's saved
					}
				});
			} catch (err) {
				console.error('Failed to load API keys:', err);
			}
		}
	});

	// ========================================================================
	// HANDLERS
	// ========================================================================

	function handleSave() {
		// Filter out empty keys
		const keysToSave: Partial<Record<Provider, string>> = {};
		(Object.keys(apiKeys) as Provider[]).forEach((provider) => {
			if (apiKeys[provider].trim()) {
				keysToSave[provider] = apiKeys[provider].trim();
			}
		});

		// Save to localStorage
		localStorage.setItem('vibeforge-planning-api-keys', JSON.stringify(keysToSave));

		// Update savedKeys state
		(Object.keys(apiKeys) as Provider[]).forEach((provider) => {
			savedKeys[provider] = !!apiKeys[provider].trim();
		});

		// Update planning store
		planningStore.setApiKeys(keysToSave);

		// Show success message
		saveStatus = 'API keys saved successfully!';
		setTimeout(() => {
			saveStatus = null;
		}, 3000);

		// Clear input fields
		apiKeys = {
			anthropic: '',
			openai: '',
			xai: '',
			google: ''
		};
	}

	function handleClear(provider: Provider) {
		// Remove key from localStorage
		const stored = localStorage.getItem('vibeforge-planning-api-keys');
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				delete parsed[provider];
				localStorage.setItem('vibeforge-planning-api-keys', JSON.stringify(parsed));
				savedKeys[provider] = false;

				// Update planning store
				planningStore.setApiKeys({ [provider]: undefined });

				saveStatus = `${provider} API key removed`;
				setTimeout(() => {
					saveStatus = null;
				}, 3000);
			} catch (err) {
				console.error('Failed to clear API key:', err);
			}
		}
	}

	function toggleShowKey(provider: Provider) {
		showKeys[provider] = !showKeys[provider];
	}

	const providerInfo: Record<
		Provider,
		{ name: string; description: string; link: string; icon: string }
	> = {
		anthropic: {
			name: 'Anthropic (Claude)',
			description: 'Required for Claude 3.5 Sonnet, Haiku, Opus',
			link: 'https://console.anthropic.com/settings/keys',
			icon: '🤖'
		},
		openai: {
			name: 'OpenAI (ChatGPT)',
			description: 'Required for GPT-4, GPT-3.5 Turbo',
			link: 'https://platform.openai.com/api-keys',
			icon: '🧠'
		},
		xai: {
			name: 'xAI (Grok)',
			description: 'Required for Grok models',
			link: 'https://x.ai/api',
			icon: '⚡'
		},
		google: {
			name: 'Google (Gemini)',
			description: 'Required for Gemini 1.5 Pro, Flash',
			link: 'https://makersuite.google.com/app/apikey',
			icon: '🔷'
		}
	};

	const providers = Object.keys(providerInfo) as Provider[];
</script>

<!-- ======================================================================== -->
<!-- TEMPLATE -->
<!-- ======================================================================== -->

<div class="settings-panel">
	<h3>🔑 API Key Configuration</h3>
	<p class="description">
		Configure API keys for the planning orchestrator. Keys are stored locally in your browser.
	</p>

	{#if saveStatus}
		<div class="alert alert-success">
			{saveStatus}
		</div>
	{/if}

	<div class="providers-list">
		{#each providers as provider}
			<div class="provider-card">
				<div class="provider-header">
					<div class="provider-title">
						<span class="provider-icon">{providerInfo[provider].icon}</span>
						<div>
							<h4>{providerInfo[provider].name}</h4>
							<p class="provider-desc">{providerInfo[provider].description}</p>
						</div>
					</div>
					{#if savedKeys[provider]}
						<span class="status-badge status-active">✓ Configured</span>
					{:else}
						<span class="status-badge status-inactive">Not configured</span>
					{/if}
				</div>

				<div class="provider-content">
					{#if savedKeys[provider]}
						<!-- Key is saved, show clear button -->
						<div class="saved-key-info">
							<span class="key-placeholder">••••••••••••••••••••</span>
							<button class="btn-clear" onclick={() => handleClear(provider)}>
								Remove Key
							</button>
						</div>
					{:else}
						<!-- No key saved, show input -->
						<div class="key-input-group">
							<input
								type={showKeys[provider] ? 'text' : 'password'}
								bind:value={apiKeys[provider]}
								placeholder="sk-ant-... or sk-proj-..."
								class="key-input"
							/>
							<button
								type="button"
								class="btn-toggle-show"
								onclick={() => toggleShowKey(provider)}
							>
								{showKeys[provider] ? '👁️' : '👁️‍🗨️'}
							</button>
						</div>
					{/if}

					<a
						href={providerInfo[provider].link}
						target="_blank"
						rel="noopener noreferrer"
						class="get-key-link"
					>
						Get API Key →
					</a>
				</div>
			</div>
		{/each}
	</div>

	<div class="actions">
		<button type="button" onclick={handleSave} class="btn-primary">
			Save API Keys
		</button>
	</div>

	<div class="security-note">
		<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
			></path>
		</svg>
		<p>
			API keys are stored securely in your browser's local storage and never sent to our servers.
			Only you have access to these keys.
		</p>
	</div>
</div>

<!-- ======================================================================== -->
<!-- STYLES -->
<!-- ======================================================================== -->

<style>
	.settings-panel {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		max-width: 800px;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		color: var(--color-text-primary);
	}

	.description {
		margin: 0 0 1.5rem 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.alert {
		padding: 0.75rem 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.alert-success {
		background: var(--color-success-bg, #e8f5e9);
		border: 1px solid var(--color-success, #4caf50);
		color: var(--color-success, #4caf50);
	}

	.providers-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.provider-card {
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 1rem;
		transition: border-color 0.2s;
	}

	.provider-card:hover {
		border-color: var(--color-primary, #4a90e2);
	}

	.provider-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.provider-title {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.provider-icon {
		font-size: 1.5rem;
	}

	h4 {
		margin: 0 0 0.25rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.provider-desc {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.status-badge {
		padding: 0.25rem 0.625rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.status-active {
		background: var(--color-success-bg, #e8f5e9);
		color: var(--color-success, #4caf50);
	}

	.status-inactive {
		background: var(--color-surface-secondary, #f5f5f5);
		color: var(--color-text-secondary);
	}

	.provider-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.saved-key-info {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.key-placeholder {
		flex: 1;
		font-family: monospace;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.btn-clear {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-error, #f44336);
		border-radius: 4px;
		background: transparent;
		color: var(--color-error, #f44336);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-clear:hover {
		background: var(--color-error, #f44336);
		color: white;
	}

	.key-input-group {
		display: flex;
		gap: 0.5rem;
	}

	.key-input {
		flex: 1;
		padding: 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-size: 0.875rem;
		font-family: monospace;
		background: var(--color-input-bg, #fff);
		color: var(--color-text-primary);
	}

	.key-input:focus {
		outline: none;
		border-color: var(--color-primary, #4a90e2);
	}

	.btn-toggle-show {
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-surface);
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-toggle-show:hover {
		background: var(--color-surface-hover, #f0f0f0);
	}

	.get-key-link {
		font-size: 0.75rem;
		color: var(--color-primary, #4a90e2);
		text-decoration: none;
		transition: opacity 0.2s;
	}

	.get-key-link:hover {
		opacity: 0.8;
		text-decoration: underline;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.btn-primary {
		padding: 0.625rem 1.25rem;
		border: none;
		border-radius: 4px;
		background: var(--color-primary, #4a90e2);
		color: white;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover, #3a7bc8);
	}

	.security-note {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding: 1rem;
		background: var(--color-surface-secondary, #f5f5f5);
		border-radius: 4px;
	}

	.security-note .icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		color: var(--color-text-secondary);
	}

	.security-note p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}
</style>
