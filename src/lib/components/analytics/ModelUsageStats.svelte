<!-- @component
Model Usage Statistics Component
Displays model usage counts, acceptance rates, and call distribution
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { performanceMetrics } from "$lib/services/modelRouter";
  import type { LLMProviderType } from "$lib/services/llm/types";

  export let dateRange: { start: Date; end: Date };

  interface ModelStats {
    totalRequests: number;
    acceptedCount: number;
    errorCount: number;
    avgResponseTime: number;
  }

  let modelStats: Array<{ model: string; provider: LLMProviderType; stats: ModelStats }> = [];
  let totalCalls = 0;

  $: if (dateRange) {
    loadUsageData();
  }

  onMount(() => {
    loadUsageData();
  });

  function loadUsageData() {
    const models: Array<{ id: string; provider: LLMProviderType }> = [
      { id: "gpt-4", provider: "openai" },
      { id: "gpt-4o", provider: "openai" },
      { id: "gpt-3.5-turbo", provider: "openai" },
      { id: "claude-opus", provider: "anthropic" },
      { id: "claude-sonnet", provider: "anthropic" },
      { id: "claude-haiku", provider: "anthropic" },
      { id: "llama-2-70b", provider: "ollama" },
      { id: "llama-2-13b", provider: "ollama" },
    ];

    modelStats = [];
    totalCalls = 0;

    for (const { id, provider } of models) {
      const metrics = performanceMetrics.getMetrics(id, provider);
      if (metrics && metrics.totalRequests > 0) {
        const stats: ModelStats = {
          totalRequests: metrics.totalRequests,
          acceptedCount: Math.round(
            metrics.recommendationAcceptanceRate * metrics.totalRequests
          ),
          errorCount: Math.round(metrics.errorRate * metrics.totalRequests),
          avgResponseTime: metrics.avgResponseTimeMs,
        };
        modelStats.push({ model: id, provider, stats });
        totalCalls += metrics.totalRequests;
      }
    }

    // Sort by usage
    modelStats.sort((a, b) => b.stats.totalRequests - a.stats.totalRequests);
  }

  function getModelColor(index: number): string {
    const colors = [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ef4444",
      "#06b6d4",
      "#ec4899",
      "#14b8a6",
    ];
    return colors[index % colors.length];
  }

  function calculatePercentage(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 0;
  }

  function getAcceptanceRate(stats: ModelStats): number {
    return stats.totalRequests > 0
      ? (stats.acceptedCount / stats.totalRequests) * 100
      : 0;
  }
</script>

<div class="space-y-6">
  {#if modelStats.length > 0}
    <!-- Usage Distribution -->
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">
        Usage Distribution
      </h3>
      <div class="space-y-3">
        {#each modelStats as { model, provider, stats }, index}
          <div>
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <div
                  class="w-3 h-3 rounded-full"
                  style="background-color: {getModelColor(index)}"
                />
                <span class="text-sm text-slate-100">{provider}/{model}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm text-slate-100"
                  >{stats.totalRequests} calls</span
                >
                <span class="text-xs text-slate-400">
                  {calculatePercentage(stats.totalRequests, totalCalls).toFixed(
                    1
                  )}%
                </span>
              </div>
            </div>
            <div class="h-2 bg-forge-blacksteel rounded-full overflow-hidden">
              <div
                class="h-full transition-all"
                style="width: {calculatePercentage(
                  stats.totalRequests,
                  totalCalls
                )}%; background-color: {getModelColor(index)}"
              />
            </div>
          </div>
        {/each}
      </div>
      <div class="mt-4 pt-4 border-t border-forge-steelgray">
        <div class="text-sm text-slate-300">
          Total: <span class="font-medium text-slate-100">{totalCalls}</span>
          calls across
          <span class="font-medium text-slate-100">{modelStats.length}</span> models
        </div>
      </div>
    </div>

    <!-- Acceptance Rates -->
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">
        Model Acceptance Rates
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each modelStats as { model, provider, stats }}
          <div class="bg-forge-blacksteel rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-100 font-medium">{model}</span>
              <span class="text-xs text-slate-400">{provider}</span>
            </div>
            <div class="flex items-baseline gap-2 mb-2">
              <span class="text-2xl font-bold text-green-400">
                {getAcceptanceRate(stats).toFixed(1)}%
              </span>
              <span class="text-xs text-slate-400">accepted</span>
            </div>
            <div class="text-xs text-slate-400">
              {stats.acceptedCount} / {stats.totalRequests} calls
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Detailed Statistics Table -->
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">
        Detailed Statistics
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-forge-steelgray">
              <th class="text-left text-xs font-medium text-slate-400 pb-2 pr-4"
                >Model</th
              >
              <th
                class="text-right text-xs font-medium text-slate-400 pb-2 px-2"
                >Total Calls</th
              >
              <th
                class="text-right text-xs font-medium text-slate-400 pb-2 px-2"
                >Accepted</th
              >
              <th
                class="text-right text-xs font-medium text-slate-400 pb-2 px-2"
                >Errors</th
              >
              <th
                class="text-right text-xs font-medium text-slate-400 pb-2 px-2"
                >Avg Response</th
              >
              <th
                class="text-right text-xs font-medium text-slate-400 pb-2 pl-2"
                >Acceptance Rate</th
              >
            </tr>
          </thead>
          <tbody>
            {#each modelStats as { model, provider, stats }}
              <tr class="border-b border-forge-steelgray/50">
                <td class="py-3 pr-4">
                  <div class="text-sm text-slate-100">{provider}/{model}</div>
                </td>
                <td class="py-3 px-2 text-sm text-slate-100 text-right"
                  >{stats.totalRequests}</td
                >
                <td class="py-3 px-2 text-sm text-green-400 text-right"
                  >{stats.acceptedCount}</td
                >
                <td class="py-3 px-2 text-sm text-red-400 text-right"
                  >{stats.errorCount}</td
                >
                <td class="py-3 px-2 text-sm text-blue-400 text-right"
                  >{Math.round(stats.avgResponseTime)}ms</td
                >
                <td
                  class="py-3 pl-2 text-sm font-medium text-slate-100 text-right"
                >
                  {getAcceptanceRate(stats).toFixed(1)}%
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else}
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <div class="text-sm text-slate-400 text-center py-12">
        No usage data available for the selected period
      </div>
    </div>
  {/if}
</div>
