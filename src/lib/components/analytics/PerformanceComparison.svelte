<!-- @component
Performance Comparison Component
Displays model performance metrics including response times, error rates, and percentiles
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { performanceMetrics } from "$lib/services/modelRouter";
  import type { LLMProviderType } from "$lib/services/llm/types";

  export let dateRange: { start: Date; end: Date };

  interface PerformanceStats {
    totalRequests: number;
    errorCount: number;
    acceptedCount: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    // Aliases for shorter access
    p50?: number;
    p95?: number;
    p99?: number;
  }

  let modelPerformance: Array<{ model: string; provider: LLMProviderType; stats: PerformanceStats }> = [];

  $: if (dateRange) {
    loadPerformanceData();
  }

  onMount(() => {
    loadPerformanceData();
  });

  function loadPerformanceData() {
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

    modelPerformance = [];

    for (const { id, provider } of models) {
      const metrics = performanceMetrics.getMetrics(id, provider);
      if (metrics && metrics.totalRequests > 0) {
        const stats: PerformanceStats = {
          totalRequests: metrics.totalRequests,
          errorCount: Math.round(metrics.errorRate * metrics.totalRequests),
          acceptedCount: Math.round(
            metrics.recommendationAcceptanceRate * metrics.totalRequests
          ),
          avgResponseTime: metrics.avgResponseTimeMs,
          p50ResponseTime: metrics.p50ResponseTimeMs,
          p95ResponseTime: metrics.p95ResponseTimeMs,
          p99ResponseTime: metrics.p99ResponseTimeMs,
          p50: metrics.p50ResponseTimeMs,
          p95: metrics.p95ResponseTimeMs,
          p99: metrics.p99ResponseTimeMs,
        };
        modelPerformance.push({ model: id, provider, stats });
      }
    }

    // Sort by average response time
    modelPerformance.sort((a, b) => a.stats.avgResponseTime - b.stats.avgResponseTime);
  }

  function getResponseTimeColor(time: number): string {
    if (time < 1000) return "text-green-400";
    if (time < 3000) return "text-yellow-400";
    return "text-orange-400";
  }

  function getErrorRateColor(rate: number): string {
    if (rate === 0) return "text-green-400";
    if (rate < 0.05) return "text-yellow-400";
    return "text-red-400";
  }

  function calculateErrorRate(stats: PerformanceStats): number {
    return stats.totalRequests > 0 ? (stats.errorCount / stats.totalRequests) * 100 : 0;
  }

  function getPerformanceGrade(stats: PerformanceStats): string {
    const avgTime = stats.avgResponseTime;
    const errorRate = calculateErrorRate(stats);
    const acceptanceRate = stats.totalRequests > 0 ? (stats.acceptedCount / stats.totalRequests) * 100 : 0;

    let score = 0;
    
    // Response time scoring (0-40 points)
    if (avgTime < 1000) score += 40;
    else if (avgTime < 2000) score += 30;
    else if (avgTime < 3000) score += 20;
    else score += 10;

    // Error rate scoring (0-30 points)
    if (errorRate === 0) score += 30;
    else if (errorRate < 5) score += 20;
    else if (errorRate < 10) score += 10;

    // Acceptance rate scoring (0-30 points)
    if (acceptanceRate >= 95) score += 30;
    else if (acceptanceRate >= 80) score += 20;
    else if (acceptanceRate >= 60) score += 10;

    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    return "D";
  }

  function getGradeColor(grade: string): string {
    if (grade.startsWith("A")) return "text-green-400";
    if (grade === "B") return "text-blue-400";
    if (grade === "C") return "text-yellow-400";
    return "text-red-400";
  }
</script>

<div class="space-y-6">
  {#if modelPerformance.length > 0}
    <!-- Performance Grades -->
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">Performance Grades</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {#each modelPerformance as { model, provider, stats }}
          {@const grade = getPerformanceGrade(stats)}
          <div class="bg-forge-blacksteel rounded-lg p-4 text-center">
            <div class="text-xs text-slate-400 mb-1">{provider}</div>
            <div class="text-sm text-slate-100 font-medium mb-2">{model}</div>
            <div class="text-3xl font-bold {getGradeColor(grade)}">{grade}</div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Response Time Comparison -->
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">Response Time Comparison</h3>
      <div class="space-y-3">
        {#each modelPerformance as { model, provider, stats }}
          {@const maxTime = Math.max(...modelPerformance.map(m => m.stats.avgResponseTime))}
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm text-slate-100">{provider}/{model}</span>
              <span class="text-sm font-medium {getResponseTimeColor(stats.avgResponseTime)}">
                {Math.round(stats.avgResponseTime)}ms
              </span>
            </div>
            <div class="h-6 bg-forge-blacksteel rounded-full overflow-hidden">
              <div
                class="h-full bg-linear-to-r from-green-400 to-blue-500 transition-all flex items-center justify-end pr-2"
                style="width: {(stats.avgResponseTime / maxTime) * 100}%"
              >
                <span class="text-xs text-white font-medium">{Math.round(stats.avgResponseTime)}ms</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Detailed Performance Metrics -->
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <h3 class="text-sm font-semibold text-slate-100 mb-4">Detailed Performance Metrics</h3>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-forge-steelgray">
              <th class="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Model</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 px-2">Calls</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 px-2">Avg Time</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 px-2">p50</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 px-2">p95</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 px-2">p99</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 px-2">Error Rate</th>
              <th class="text-right text-xs font-medium text-slate-400 pb-2 pl-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {#each modelPerformance as { model, provider, stats }}
              {@const grade = getPerformanceGrade(stats)}
              {@const errorRate = calculateErrorRate(stats)}
              <tr class="border-b border-forge-steelgray/50">
                <td class="py-3 pr-4">
                  <div class="text-sm text-slate-100">{provider}/{model}</div>
                </td>
                <td class="py-3 px-2 text-sm text-slate-100 text-right">{stats.totalRequests}</td>
                <td class="py-3 px-2 text-sm {getResponseTimeColor(stats.avgResponseTime)} text-right">
                  {Math.round(stats.avgResponseTime)}ms
                </td>
                <td class="py-3 px-2 text-sm text-slate-400 text-right">
                  {stats.p50 ? Math.round(stats.p50) : "—"}
                </td>
                <td class="py-3 px-2 text-sm text-slate-400 text-right">
                  {stats.p95 ? Math.round(stats.p95) : "—"}
                </td>
                <td class="py-3 px-2 text-sm text-slate-400 text-right">
                  {stats.p99 ? Math.round(stats.p99) : "—"}
                </td>
                <td class="py-3 px-2 text-sm {getErrorRateColor(errorRate / 100)} text-right">
                  {errorRate.toFixed(1)}%
                </td>
                <td class="py-3 pl-2 text-sm font-bold {getGradeColor(grade)} text-right">
                  {grade}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Performance Notes -->
    <div class="bg-forge-gunmetal rounded-lg p-4 border border-forge-steelgray">
      <div class="text-xs text-slate-400">
        <strong class="text-slate-300">Grading System:</strong> Based on response time (40%), error rate (30%), and acceptance rate (30%).
        <span class="text-green-400 ml-2">A+/A</span> = Excellent,
        <span class="text-blue-400 ml-2">B</span> = Good,
        <span class="text-yellow-400 ml-2">C</span> = Fair,
        <span class="text-red-400 ml-2">D</span> = Poor
      </div>
    </div>
  {:else}
    <div class="bg-forge-gunmetal rounded-lg p-6 border border-forge-steelgray">
      <div class="text-sm text-slate-400 text-center py-12">
        No performance data available for the selected period
      </div>
    </div>
  {/if}
</div>
