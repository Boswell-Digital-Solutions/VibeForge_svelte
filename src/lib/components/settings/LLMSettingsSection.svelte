<!-- @component
no description yet
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { llmClient } from "$lib/services/llm/client";
  import type { LLMConfig, LLMProviderType } from "$lib/services/llm/types";

  // State
  let provider: LLMProviderType = "openai";
  let apiKey: string = "";
  let baseUrl: string = "";
  let model: string = "";
  let temperature: number = 0.7;
  let maxTokens: number = 2000;
  let timeout: number = 30000;

  // UI State
  let testing: boolean = false;
  let testResult: { success: boolean; message: string } | null = null;
  let saving: boolean = false;
  let saveResult: string = "";
  let showApiKey: boolean = false;

  // Available models per provider
  const modelsByProvider: Record<
    LLMProviderType,
    { id: string; name: string }[]
  > = {
    openai: [
      { id: "gpt-4", name: "GPT-4 (Most Capable)" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo (Faster)" },
      { id: "gpt-4o", name: "GPT-4o (Multimodal)" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo (Fastest)" },
    ],
    anthropic: [
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus (Most Capable)" },
      {
        id: "claude-3-5-sonnet-20240620",
        name: "Claude 3.5 Sonnet (Best Value)",
      },
      { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (Fastest)" },
    ],
    ollama: [
      { id: "llama3:70b", name: "Llama 3 70B" },
      { id: "llama3:13b", name: "Llama 3 13B" },
      { id: "llama3:7b", name: "Llama 3 7B" },
      { id: "mistral:latest", name: "Mistral Latest" },
    ],
    custom: [],
  };

  // Base URLs per provider
  const defaultBaseUrls: Record<LLMProviderType, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    ollama: "http://localhost:11434",
    custom: "",
  };

  // Load saved config
  onMount(() => {
    const savedConfig = llmClient.getConfig();
    if (savedConfig) {
      provider = savedConfig.provider;
      baseUrl = savedConfig.baseUrl || defaultBaseUrls[provider];
      model = savedConfig.model || modelsByProvider[provider][0]?.id || "";
      temperature = savedConfig.temperature ?? 0.7;
      maxTokens = savedConfig.maxTokens ?? 2000;
      timeout = savedConfig.timeout ?? 30000;
      // Don't load API key for security
    } else {
      baseUrl = defaultBaseUrls[provider];
      model = modelsByProvider[provider][0]?.id || "";
    }
  });

  // Handle provider change
  function handleProviderChange() {
    baseUrl = defaultBaseUrls[provider];
    model = modelsByProvider[provider][0]?.id || "";
    testResult = null;
    saveResult = "";
  }

  // Build config object
  function buildConfig(): LLMConfig {
    return {
      provider,
      apiKey: provider === "ollama" ? undefined : apiKey,
      baseUrl: baseUrl || undefined,
      model,
      temperature,
      maxTokens,
      timeout,
      retryAttempts: 3,
      retryDelay: 1000,
    };
  }

  // Test connection
  async function testConnection() {
    if (provider !== "ollama" && !apiKey.trim()) {
      testResult = {
        success: false,
        message: "API key is required",
      };
      return;
    }

    testing = true;
    testResult = null;

    try {
      const config = buildConfig();
      const result = await llmClient.testConfig(config);

      testResult = {
        success: result.success,
        message: result.success
          ? "✅ Connection successful!"
          : `⚠️ ${result.error ?? "Provider available but not fully configured"}`,
      };
    } catch (error) {
      testResult = {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    } finally {
      testing = false;
    }
  }

  // Save configuration
  async function saveConfiguration() {
    if (provider !== "ollama" && !apiKey.trim()) {
      saveResult = "API key is required";
      return;
    }

    saving = true;
    saveResult = "";

    try {
      const config = buildConfig();
      // initialize() persists the config itself.
      await llmClient.initialize(config);

      saveResult = "Configuration saved successfully!";
      setTimeout(() => {
        saveResult = "";
      }, 3000);
    } catch (error) {
      saveResult =
        error instanceof Error ? error.message : "Failed to save configuration";
    } finally {
      saving = false;
    }
  }

  // Get cost info
  function getCostInfo(): string {
    if (provider === "ollama") return "Free (Local)";
    if (provider === "openai") {
      if (model.includes("gpt-4o")) return "$0.0025-$0.01 per 1K tokens";
      if (model.includes("gpt-4")) return "$0.01-$0.06 per 1K tokens";
      return "$0.0005-$0.0015 per 1K tokens";
    }
    if (provider === "anthropic") {
      if (model.includes("opus")) return "$0.015-$0.075 per 1K tokens";
      if (model.includes("sonnet")) return "$0.003-$0.015 per 1K tokens";
      return "$0.00025-$0.00125 per 1K tokens";
    }
    return "Varies";
  }
</script>

<div class="llm-settings-section">
  <div class="section-header">
    <h2>🤖 AI Model Configuration</h2>
    <p>
      Configure LLM providers for AI-powered stack recommendations and code
      analysis
    </p>
  </div>

  <div class="settings-form">
    <!-- Provider Selection -->
    <div class="form-group">
      <label for="provider">Provider</label>
      <select
        id="provider"
        bind:value={provider}
        onchange={handleProviderChange}
      >
        <option value="openai">OpenAI (GPT-4, GPT-3.5)</option>
        <option value="anthropic">Anthropic (Claude)</option>
        <option value="ollama">Ollama (Local Models)</option>
      </select>
      <span class="help-text">Choose your LLM provider</span>
    </div>

    <!-- API Key -->
    {#if provider !== "ollama"}
      <div class="form-group">
        <label for="apiKey">API Key</label>
        <div class="api-key-input">
          <input
            id="apiKey"
            type={showApiKey ? "text" : "password"}
            bind:value={apiKey}
            placeholder="sk-..."
            autocomplete="off"
          />
          <button
            class="toggle-visibility"
            onclick={() => (showApiKey = !showApiKey)}
            type="button"
          >
            {showApiKey ? "👁️" : "👁️‍🗨️"}
          </button>
        </div>
        <span class="help-text">
          {#if provider === "openai"}
            Get your API key from <a
              href="https://platform.openai.com/api-keys"
              target="_blank">platform.openai.com</a
            >
          {:else if provider === "anthropic"}
            Get your API key from <a
              href="https://console.anthropic.com"
              target="_blank">console.anthropic.com</a
            >
          {/if}
        </span>
      </div>
    {/if}

    <!-- Base URL -->
    <div class="form-group">
      <label for="baseUrl">Base URL</label>
      <input
        id="baseUrl"
        type="text"
        bind:value={baseUrl}
        placeholder={defaultBaseUrls[provider]}
      />
      <span class="help-text">Leave default unless using a custom endpoint</span
      >
    </div>

    <!-- Model Selection -->
    <div class="form-group">
      <label for="model">Model</label>
      <select id="model" bind:value={model}>
        {#each modelsByProvider[provider] as modelOption}
          <option value={modelOption.id}>{modelOption.name}</option>
        {/each}
      </select>
      <span class="help-text cost-info">
        <strong>Cost:</strong>
        {getCostInfo()}
      </span>
    </div>

    <!-- Advanced Settings -->
    <details class="advanced-settings">
      <summary>Advanced Settings</summary>

      <div class="form-group">
        <label for="temperature">
          Temperature: <strong>{temperature}</strong>
        </label>
        <input
          id="temperature"
          type="range"
          min="0"
          max="1"
          step="0.1"
          bind:value={temperature}
        />
        <span class="help-text"
          >Higher = more creative, Lower = more deterministic (0.0-1.0)</span
        >
      </div>

      <div class="form-group">
        <label for="maxTokens">Max Tokens</label>
        <input
          id="maxTokens"
          type="number"
          bind:value={maxTokens}
          min="100"
          max="8000"
        />
        <span class="help-text">Maximum response length (default: 2000)</span>
      </div>

      <div class="form-group">
        <label for="timeout">Timeout (ms)</label>
        <input
          id="timeout"
          type="number"
          bind:value={timeout}
          min="5000"
          max="120000"
        />
        <span class="help-text"
          >Request timeout in milliseconds (default: 30000)</span
        >
      </div>
    </details>

    <!-- Test & Save Buttons -->
    <div class="action-buttons">
      <button class="btn-test" onclick={testConnection} disabled={testing}>
        {#if testing}
          <span class="spinner" />
          Testing...
        {:else}
          Test Connection
        {/if}
      </button>

      <button class="btn-save" onclick={saveConfiguration} disabled={saving}>
        {#if saving}
          <span class="spinner" />
          Saving...
        {:else}
          Save Configuration
        {/if}
      </button>
    </div>

    <!-- Test Result -->
    {#if testResult}
      <div class="result {testResult.success ? 'success' : 'error'}">
        {testResult.message}
      </div>
    {/if}

    <!-- Save Result -->
    {#if saveResult}
      <div
        class="result {saveResult.includes('success') ? 'success' : 'error'}"
      >
        {saveResult}
      </div>
    {/if}
  </div>
</div>

<style>
  .llm-settings-section {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .section-header {
    margin-bottom: 2rem;
  }

  .section-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  .section-header p {
    color: #6b7280;
    font-size: 0.95rem;
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 600;
    color: #374151;
    font-size: 0.95rem;
  }

  .form-group input[type="text"],
  .form-group input[type="password"],
  .form-group input[type="number"],
  .form-group select {
    padding: 0.75rem;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .api-key-input {
    position: relative;
  }

  .api-key-input input {
    width: 100%;
    padding-right: 3rem;
  }

  .toggle-visibility {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .toggle-visibility:hover {
    background: #f3f4f6;
  }

  .help-text {
    font-size: 0.85rem;
    color: #6b7280;
  }

  .help-text a {
    color: #667eea;
    text-decoration: none;
  }

  .help-text a:hover {
    text-decoration: underline;
  }

  .cost-info {
    background: #fef3c7;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border-left: 3px solid #f59e0b;
  }

  .cost-info strong {
    color: #92400e;
  }

  .advanced-settings {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: #f9fafb;
  }

  .advanced-settings summary {
    cursor: pointer;
    font-weight: 600;
    color: #374151;
    user-select: none;
  }

  .advanced-settings summary:hover {
    color: #667eea;
  }

  .advanced-settings[open] summary {
    margin-bottom: 1rem;
  }

  input[type="range"] {
    width: 100%;
    accent-color: #667eea;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .btn-test,
  .btn-save {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-test {
    background: white;
    color: #667eea;
    border: 2px solid #667eea;
  }

  .btn-test:hover:not(:disabled) {
    background: #f5f3ff;
  }

  .btn-save {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-test:disabled,
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .result {
    padding: 1rem;
    border-radius: 8px;
    font-weight: 500;
    text-align: center;
  }

  .result.success {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #86efac;
  }

  .result.error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  @media (max-width: 768px) {
    .llm-settings-section {
      padding: 1.5rem;
    }

    .action-buttons {
      flex-direction: column;
    }
  }
</style>
