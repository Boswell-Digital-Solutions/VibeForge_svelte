<script lang="ts">
  import { themeStore } from "$lib/core/stores";
  import { pinnedPresets, allPresets, presets } from "$lib/stores/presets";
  import type { Preset } from "$lib/stores/presets";
  import PresetsHeader from "$lib/components/presets/PresetsHeader.svelte";
  import PresetsList from "$lib/components/presets/PresetsList.svelte";
  import PresetDetailPanel from "$lib/components/presets/PresetDetailPanel.svelte";

  interface Props {
    open: boolean;
    mode?: "workbench" | "quick-run";
    onClose?: () => void;
    onApplyPreset?: (preset: Preset) => void;
  }

  const {
    open,
    mode = "workbench",
    onClose = () => {},
    onApplyPreset = () => {},
  }: Props = $props();

  let activeTab = $state<"pinned" | "all">("pinned");
  let activePresetId = $state<string | null>(null);

  const activePreset = $derived(
    $presets.find((p) => p.id === activePresetId) || null
  );

  const displayPresets = $derived(
    activeTab === "pinned" ? $pinnedPresets : $allPresets
  );

  const handleTogglePinned = (id: string) => {
    presets.togglePinned(id);
  };

  const handleApplyPreset = (preset: Preset) => {
    onApplyPreset(preset);
    onClose();
    // TODO: Wire to Workbench or Quick Run state management
  };
</script>

<!-- Presets drawer overlay -->
{#if open}
  <div class="fixed inset-0 z-40 flex justify-end pointer-events-auto">
    <!-- Backdrop -->
    <div
      class="flex-1 bg-black/40 pointer-events-auto"
      onclick={onClose}
      role="button"
      tabindex="-1"
    />

    <!-- Drawer panel -->
    <aside
      class={`w-full max-w-md h-full border-l flex flex-col overflow-hidden transition-all ${
        themeStore.current === "dark"
          ? "bg-slate-950 border-slate-800"
          : "bg-white border-slate-200"
      }`}
    >
      <!-- Header -->
      <PresetsHeader {mode} {onClose} />

      <!-- Tab bar -->
      <nav class="px-4 pt-3 pb-2 flex gap-2 text-[11px]">
        <button
          class={`px-3 py-1.5 rounded-full border transition-colors ${
            activeTab === "pinned"
              ? "bg-amber-500 text-slate-900 border-amber-500 font-medium"
              : themeStore.current === "dark"
              ? "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600"
              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
          }`}
          onclick={() => (activeTab = "pinned")}
        >
          Pinned
        </button>
        <button
          class={`px-3 py-1.5 rounded-full border transition-colors ${
            activeTab === "all"
              ? "bg-amber-500 text-slate-900 border-amber-500 font-medium"
              : themeStore.current === "dark"
              ? "bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600"
              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
          }`}
          onclick={() => (activeTab = "all")}
        >
          All presets
        </button>
      </nav>

      <!-- Content area -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Presets list -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <PresetsList
            presets={displayPresets}
            {activePresetId}
            onSelectPreset={(id) => (activePresetId = id)}
            onTogglePinned={handleTogglePinned}
          />
        </div>
      </div>

      <!-- Detail panel -->
      <PresetDetailPanel
        preset={activePreset}
        {mode}
        onApplyPreset={handleApplyPreset}
      />
    </aside>
  </div>
{/if}
