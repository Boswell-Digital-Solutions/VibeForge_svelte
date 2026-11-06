<script lang="ts">
  import { themeStore } from "$lib/core/stores";
  import { runsStore } from "$lib/core/stores/runs.svelte";
  import QuickRunHeader from "$lib/components/quickrun/QuickRunHeader.svelte";
  import QuickRunForm from "$lib/components/quickrun/QuickRunForm.svelte";
  import QuickRunOutputs from "$lib/components/quickrun/QuickRunOutputs.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import PresetsDrawer from "$lib/components/presets/PresetsDrawer.svelte";
  import SavePresetModal from "$lib/components/presets/SavePresetModal.svelte";
  import type { ContextRef } from "$lib/stores/presets";

  interface QuickOutput {
    id: string;
    model: string;
    text: string;
    tokens: number;
    cost: number;
  }

  // Local state
  let prompt = $state("");
  let selectedContextIds = $state<string[]>([]);
  let activeModelIds = $state<string[]>([]);
  let outputs = $state<QuickOutput[]>([]);
  let isLoading = $state(false);
  let showPresetsDrawer = $state(false);
  let isSavePresetOpen = $state(false);

  // Metrics
  let lastRunTokens = $state(0);
  let lastRunCost = $state(0);

  // Model labels for status bar
  const modelLabels: Record<string, string> = {
    claude: "Claude",
    "gpt-5x": "GPT-5.x",
    local: "Local",
  };

  const activeModelsLabels = $derived(
    activeModelIds.map((id) => modelLabels[id] || id)
  );

  // Mock model metadata for realistic tokens/cost
  const modelMetadata: Record<
    string,
    { tokensPerRun: number; costPerKTokens: number }
  > = {
    claude: { tokensPerRun: 150, costPerKTokens: 0.003 },
    "gpt-5x": { tokensPerRun: 200, costPerKTokens: 0.006 },
    local: { tokensPerRun: 100, costPerKTokens: 0 },
  };

  const mockResponses: Record<string, string> = {
    claude:
      "Here's a thoughtful response from Claude. It understands context deeply and provides nuanced analysis. This response is optimized for clarity and helpfulness.",
    "gpt-5x":
      "This is GPT-5.x's response. It excels at pattern recognition and detailed breakdowns. Known for concise, direct answers with strong factual grounding.",
    local:
      "Local model output. Fast execution with minimal latency. Good for rapid iterations and development testing in resource-constrained environments.",
  };

  // Event handlers
  const onPromptChange = (text: string) => {
    prompt = text;
  };

  const toggleContext = (id: string) => {
    if (selectedContextIds.includes(id)) {
      selectedContextIds = selectedContextIds.filter((c) => c !== id);
    } else {
      selectedContextIds = [...selectedContextIds, id];
    }
  };

  const toggleModel = (id: string) => {
    if (activeModelIds.includes(id)) {
      activeModelIds = activeModelIds.filter((m) => m !== id);
    } else {
      if (activeModelIds.length >= 2) {
        // Max 2 models
        activeModelIds = [activeModelIds[1], id];
      } else {
        activeModelIds = [...activeModelIds, id];
      }
    }
  };

  const runQuickPrompt = async () => {
    if (!prompt.trim() || activeModelIds.length === 0) {
      alert("Please enter a prompt and select at least one model.");
      return;
    }

    isLoading = true;
    const newOutputs: QuickOutput[] = [];

    try {
      // Execute prompt on each selected model
      for (const modelId of activeModelIds) {
        try {
          const result = await runsStore.execute(prompt, modelId, selectedContextIds);

          const metadata = modelMetadata[modelId] || {
            tokensPerRun: 150,
            costPerKTokens: 0.003,
          };
          const cost = (result.usage.total_tokens / 1000) * metadata.costPerKTokens;

          newOutputs.push({
            id: result.run_id,
            model: modelLabels[modelId] || modelId,
            text: result.output,
            tokens: result.usage.total_tokens,
            cost,
          });
        } catch (err) {
          console.error(`Failed to execute on ${modelId}:`, err);
          // Add error output
          newOutputs.push({
            id: `error-${modelId}-${Date.now()}`,
            model: modelLabels[modelId] || modelId,
            text: `Error: ${err instanceof Error ? err.message : 'Execution failed'}`,
            tokens: 0,
            cost: 0,
          });
        }
      }

      outputs = newOutputs;

      // Update metrics
      lastRunTokens = newOutputs.reduce((sum, o) => sum + o.tokens, 0);
      lastRunCost = newOutputs.reduce((sum, o) => sum + o.cost, 0);
    } finally {
      isLoading = false;
    }
  };

  const resetQuickRun = () => {
    prompt = "";
    selectedContextIds = [];
    activeModelIds = [];
    outputs = [];
    lastRunTokens = 0;
    lastRunCost = 0;
  };

  const handleApplyPreset = (event: any) => {
    const { preset } = event.detail;
    // TODO: Wire to shared state
    prompt = preset.basePrompt;
    activeModelIds = preset.models
      .map(
        (label: string) =>
          Object.entries(modelLabels).find(([_, v]) => v === label)?.[0]
      )
      .filter(Boolean) as string[];
  };

  const handleSavePreset = (event: any) => {
    const { preset } = event.detail;
    // TODO: Show toast notification
    // console.log('Preset saved from Quick Run:', preset);
    isSavePresetOpen = false;
  };

  // Helper to get current context refs (Quick Run has simplified context)
  const getCurrentContextRefs = (): ContextRef[] => {
    // Quick Run uses a simplified context list
    // Map selectedContextIds to context refs
    const contextLabelMap: Record<string, string> = {
      "ds-authorforge": "AuthorForge design rules",
      "proj-vibeforge": "VibeForge project spec",
      "code-summary": "Current file summary",
    };
    return selectedContextIds
      .map((id) => ({
        id,
        label: contextLabelMap[id] || id,
      }))
      .filter((ctx) => contextLabelMap[ctx.id]);
  };
</script>

<!-- Quick Run mini-workbench: lightweight, fast-iteration prompt runner -->
<main class="flex-1 overflow-hidden flex flex-col bg-forge-blacksteel">
  <div class="flex-1 overflow-y-auto px-8 py-6">
    <QuickRunHeader
      workspace="VibeForge Dev"
      onOpenPresets={() => (showPresetsDrawer = true)}
      onOpenSavePreset={() => (isSavePresetOpen = true)}
    />

    <QuickRunForm
      {prompt}
      {selectedContextIds}
      {activeModelIds}
      {onPromptChange}
      onContextToggle={toggleContext}
      onModelToggle={toggleModel}
      onRun={runQuickPrompt}
      onReset={resetQuickRun}
    />

    <QuickRunOutputs {outputs} {isLoading} />

    <StatusBar
      workspace="VibeForge Dev"
      project="Quick Run"
      activeModels={activeModelsLabels}
      {lastRunTokens}
      {lastRunCost}
      connectionStatus="ok"
    />
  </div>
</main>

<!-- Presets drawer -->
<PresetsDrawer
  open={showPresetsDrawer}
  mode="quick-run"
  onClose={() => (showPresetsDrawer = false)}
  onApplyPreset={handleApplyPreset}
/>

<!-- Save as Preset modal -->
<SavePresetModal
  open={isSavePresetOpen}
  mode="quick-run"
  initialPrompt={prompt}
  initialWorkspace="VibeForge Dev"
  initialModels={activeModelIds.map((id) => modelLabels[id] || id)}
  initialContextRefs={getCurrentContextRefs()}
  on:close={() => (isSavePresetOpen = false)}
  on:saved={handleSavePreset}
/>
