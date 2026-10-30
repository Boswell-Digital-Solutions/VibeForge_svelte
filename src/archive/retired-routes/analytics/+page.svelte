<script lang="ts">
  import { onMount } from "svelte";
  import { costTracker, performanceMetrics } from "$lib/services/modelRouter";
  import CostAnalytics from "$lib/components/analytics/CostAnalytics.svelte";
  import ModelUsageStats from "$lib/components/analytics/ModelUsageStats.svelte";
  import PerformanceComparison from "$lib/components/analytics/PerformanceComparison.svelte";
  import BudgetTracker from "$lib/components/analytics/BudgetTracker.svelte";

  let activeTab: "overview" | "costs" | "usage" | "performance" = "overview";
  let dateRange: { start: Date; end: Date } = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  };

  // Overview data
  let totalCost = 0;
  let totalCalls = 0;
  let avgResponseTime = 0;
  let topModel = "";

  onMount(() => {
    loadOverviewData();
  });

  function loadOverviewData() {
    // Load summary statistics
    const summary = costTracker.getSummary(dateRange.start, dateRange.end);
    totalCost = summary.total;
    totalCalls = summary.entries.length;

    // Get performance stats
    const models = [
      "gpt-4",
      "gpt-4o",
      "gpt-3.5-turbo",
      "claude-opus",
      "claude-sonnet",
      "claude-haiku",
    ];
    let maxCalls = 0;
    let totalResponseTime = 0;
    let totalCount = 0;

    for (const model of models) {
      const provider = model.startsWith("gpt") ? "openai" : "anthropic";
      const stats = performanceMetrics.getMetrics(provider, model);
      if (stats && stats.totalCount > 0) {
        totalCount += stats.totalCount;
        totalResponseTime += stats.avgResponseTime * stats.totalCount;
        if (stats.totalCount > maxCalls) {
          maxCalls = stats.totalCount;
          topModel = model;
        }
      }
    }

    avgResponseTime =
      totalCount > 0 ? Math.round(totalResponseTime / totalCount) : 0;
  }

  function updateDateRange(days: number) {
    dateRange.end = new Date();
    dateRange.start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    loadOverviewData();
  }

  function exportData(format: "csv" | "json") {
    const summary = costTracker.getSummary(dateRange.start, dateRange.end);
    const filename = `vibeforge-analytics-${
      dateRange.start.toISOString().split("T")[0]
    }-to-${dateRange.end.toISOString().split("T")[0]}`;

    if (format === "json") {
      const data = {
        dateRange: { start: dateRange.start, end: dateRange.end },
        costs: summary,
        models: {},
      };

      const models = [
        "gpt-4",
        "gpt-4o",
        "gpt-3.5-turbo",
        "claude-opus",
        "claude-sonnet",
        "claude-haiku",
      ];
      for (const model of models) {
        const provider = model.startsWith("gpt") ? "openai" : "anthropic";
        const stats = performanceMetrics.getMetrics(provider, model);
        if (stats && stats.totalCount > 0) {
          data.models[model] = stats;
        }
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV format
      let csv =
        "Date,Provider,Model,Category,Input Tokens,Output Tokens,Cost\n";
      for (const entry of summary.entries) {
        csv += `${new Date(entry.timestamp).toISOString()},${entry.provider},${
          entry.model
        },${entry.category},${entry.inputTokens},${entry.outputTokens},${
          entry.cost
        }\n`;
      }

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }
</script>

<main class="flex-1 overflow-hidden flex flex-col bg-forge-blacksteel">
  <!-- Header -->
  <div class="border-b px-8 py-6 border-forge-gunmetal">
    <div class="flex items-center justify-between">
      <div class="flex flex-col gap-1">
        <h1 class="text-base font-semibold tracking-tight text-slate-100">
          📊 Model Analytics Dashboard
        </h1>
        <p class="text-xs text-slate-400">
          Track LLM usage, costs, and performance across all models
        </p>
      </div>

      <!-- Date Range Selector -->
      <div class="flex items-center gap-2">
        <div class="flex gap-1 bg-forge-gunmetal rounded-lg p-1">
          <button
            class="px-3 py-1.5 text-xs rounded transition-all {dateRange.start.getTime() ===
            Date.now() - 7 * 24 * 60 * 60 * 1000
              ? 'bg-forge-ember text-white'
              : 'text-slate-300 hover:text-slate-100'}"
            onclick={() => updateDateRange(7)}
          >
            7 Days
          </button>
          <button
            class="px-3 py-1.5 text-xs rounded transition-all {dateRange.start.getTime() ===
            Date.now() - 30 * 24 * 60 * 60 * 1000
              ? 'bg-forge-ember text-white'
              : 'text-slate-300 hover:text-slate-100'}"
            onclick={() => updateDateRange(30)}
          >
            30 Days
          </button>
          <button
            class="px-3 py-1.5 text-xs rounded transition-all {dateRange.start.getTime() ===
            Date.now() - 90 * 24 * 60 * 60 * 1000
              ? 'bg-forge-ember text-white'
              : 'text-slate-300 hover:text-slate-100'}"
            onclick={() => updateDateRange(90)}
          >
            90 Days
          </button>
        </div>

        <!-- Export Buttons -->
        <button
          class="px-3 py-1.5 text-xs bg-forge-steelgray text-slate-100 rounded hover:bg-forge-steelgray/80 transition-all"
          onclick={() => exportData("csv")}
        >
          Export CSV
        </button>
        <button
          class="px-3 py-1.5 text-xs bg-forge-steelgray text-slate-100 rounded hover:bg-forge-steelgray/80 transition-all"
          onclick={() => exportData("json")}
        >
          Export JSON
        </button>
      </div>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="border-b border-forge-gunmetal px-8">
    <nav class="flex gap-6">
      <button
        class="py-3 text-sm font-medium border-b-2 transition-all {activeTab ===
        'overview'
          ? 'border-forge-ember text-slate-100'
          : 'border-transparent text-slate-400 hover:text-slate-300'}"
        onclick={() => (activeTab = "overview")}
      >
        Overview
      </button>
      <button
        class="py-3 text-sm font-medium border-b-2 transition-all {activeTab ===
        'costs'
          ? 'border-forge-ember text-slate-100'
          : 'border-transparent text-slate-400 hover:text-slate-300'}"
        onclick={() => (activeTab = "costs")}
      >
        Cost Analytics
      </button>
      <button
        class="py-3 text-sm font-medium border-b-2 transition-all {activeTab ===
        'usage'
          ? 'border-forge-ember text-slate-100'
          : 'border-transparent text-slate-400 hover:text-slate-300'}"
        onclick={() => (activeTab = "usage")}
      >
        Model Usage
      </button>
      <button
        class="py-3 text-sm font-medium border-b-2 transition-all {activeTab ===
        'performance'
          ? 'border-forge-ember text-slate-100'
          : 'border-transparent text-slate-400 hover:text-slate-300'}"
        onclick={() => (activeTab = "performance")}
      >
        Performance
      </button>
    </nav>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto px-8 py-6">
    {#if activeTab === "overview"}
      <!-- Overview Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div
          class="bg-forge-gunmetal rounded-lg p-4 border border-forge-steelgray"
        >
          <div class="text-xs text-slate-400 mb-1">Total Cost</div>
          <div class="text-2xl font-bold text-forge-ember">
            ${totalCost.toFixed(2)}
          </div>
          <div class="text-xs text-slate-400 mt-1">
            Last {Math.round(
              (dateRange.end.getTime() - dateRange.start.getTime()) /
                (24 * 60 * 60 * 1000)
            )} days
          </div>
        </div>

        <div
          class="bg-forge-gunmetal rounded-lg p-4 border border-forge-steelgray"
        >
          <div class="text-xs text-slate-400 mb-1">Total Calls</div>
          <div class="text-2xl font-bold text-blue-400">{totalCalls}</div>
          <div class="text-xs text-slate-400 mt-1">LLM requests</div>
        </div>

        <div
          class="bg-forge-gunmetal rounded-lg p-4 border border-forge-steelgray"
        >
          <div class="text-xs text-slate-400 mb-1">Avg Response Time</div>
          <div class="text-2xl font-bold text-green-400">
            {avgResponseTime}ms
          </div>
          <div class="text-xs text-slate-400 mt-1">Across all models</div>
        </div>

        <div
          class="bg-forge-gunmetal rounded-lg p-4 border border-forge-steelgray"
        >
          <div class="text-xs text-slate-400 mb-1">Top Model</div>
          <div class="text-2xl font-bold text-purple-400">
            {topModel || "N/A"}
          </div>
          <div class="text-xs text-slate-400 mt-1">Most frequently used</div>
        </div>
      </div>

      <!-- Quick Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetTracker {dateRange} />
        <CostAnalytics {dateRange} compact={true} />
      </div>
    {:else if activeTab === "costs"}
      <CostAnalytics {dateRange} compact={false} />
    {:else if activeTab === "usage"}
      <ModelUsageStats {dateRange} />
    {:else if activeTab === "performance"}
      <PerformanceComparison {dateRange} />
    {/if}
  </div>
</main>
