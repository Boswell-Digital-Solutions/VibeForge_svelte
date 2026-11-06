# VibeForge Copilot Instructions

## Architecture Overview

**VibeForge** is a professional prompt workbench (not a chat UI) built with SvelteKit + Vite + Tailwind. It implements a **3-column layout** philosophy:
- **Context Column** (`$lib/workbench/context/ContextColumn.svelte`): Library of reusable prompt blocks (system, design, project, code, workflow kinds)
- **Prompt Column** (`$lib/workbench/prompt/PromptColumn.svelte`): Primary text editor with active context chips and token estimation
- **Output Column** (`$lib/workbench/output/OutputColumn.svelte`): Model responses and run history

The design emphasizes **low cognitive load** and professional workflows. Core motivation: AI coding agents need structured context + clear prompts + execution history.

## Project Setup & Development

**Tech Stack:**
- **SvelteKit 2.x** with TypeScript 5.9
- **Vite 7** for fast dev/build, `pnpm` monorepo package manager
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **Svelte 5.43** with runes (`$state`, `$derived`, `$props`)

**Key Commands:**
```bash
pnpm dev          # Start dev server on :5173
pnpm build        # Production build
pnpm preview      # Serve built output
pnpm check        # TypeScript + svelte-check validation
pnpm check:watch  # Watch mode validation
```

**Project Structure:**
- `src/routes/` — SvelteKit pages (standard file-based routing)
- `src/lib/ui/layout/` — app shell: `TopBar`, `LeftRailNav`, `StatusBar`, `WorkbenchShell`
- `src/lib/workbench/` — the 3-column workbench, wizard and planning
- `src/lib/components/` — feature UI, grouped by domain
- `src/lib/core/` — stores, API clients, domain types, sync, MCP, execution
- `src/lib/stores/` — feature-local stores (see State Management below)
- `src/lib/core/types/` — domain interfaces (`ContextBlock`, runs, workspaces)
- `src/app.css` — Tailwind + Forge design tokens (see below)
- `src/archive/` — retired code, outside the route tree; excluded from `svelte-check`

## Design System: "Forge" Palette

VibeForge uses a **dark-by-default** theme inspired by forged steel and embers. Tailwind theme extensions in `tailwind.config.cjs.bak`:

**Metal/Dark Tones:**
- `forge-blacksteel: #0B0F17` — Main background (deepest)
- `forge-gunmetal: #111827` — Secondary backgrounds
- `forge-steel: #1E293B` — Tertiary / interactive states

**Light/Quench Surfaces (Light Mode):**
- `forge-quench: #F8FAFC` — Primary light background
- `forge-quenchLift: #E2E8F0` — Accent light backgrounds

**Text & Borders:**
- `forge-textBright: #F8FAFC`, `forge-textDim: #CBD5E1`, `forge-textMuted: #94A3B8` (dark mode)
- `forge-line: #233044` — Dark borders, `forge-lineLight: #CBD5E1` (light mode)

**Accent:**
- `forge-ember: #FBBF24` — Primary action/highlight (warm amber)
- `forge-emberHover: #F59E0B` — Hover state

**Functional Colors:**
- `forge-info: #3B82F6`, `forge-danger: #EF4444`, `forge-success: #22C55E`

**Pattern:** All color-aware components read `themeStore.current` and apply conditional Tailwind classes for light/dark support (see `LeftRailNav.svelte`, `PromptColumn.svelte` for examples).

## State Management: two layers, two idioms

State lives in two places with different conventions. The `.svelte.ts` suffix
is the reliable signal: it means Svelte 5 runes.

### `src/lib/core/stores/` — runes (primary)

Each module keeps a module-level `$state` object, derives with `$derived`, and
exports one object whose getters expose state and whose other properties are
plain action functions. **There is no `subscribe` and no `$` prefix.** Read a
value as `themeStore.current`; call an action as `themeStore.toggle()`.

Re-exported from `$lib/core/stores`:

- `workspaceStore` — workspaces, current selection, settings, sync status
- `contextBlocksStore` — context blocks, `activeBlocks`, `totalActiveTokens`;
  actions `addBlock`, `updateBlock`, `removeBlock`, `toggleActive`, `reorderBlock`
- `promptStore` — `text`, `variables`, `currentTemplate`, `estimatedTokens`,
  `resolvedPrompt`; actions `setText`, `appendText`, `setVariable`, `loadTemplate`
- `modelsStore` — `models`, `selectedModels`, `estimatedCost`; actions
  `selectModel`, `toggleModel`, `selectOnly`
- `runsStore` — `runs`, `activeRun`, `totalTokensUsed`, `totalCost`; actions
  `execute`, `executeFromStores`, `addRun`, `startExecution`, `completeExecution`
- `toolsStore` — MCP servers, tools and invocations
- `themeStore` — `current`, `isDark`, `isLight`; actions `toggle`, `setTheme`
- `licenseStore` — tier, trial state, `checkFeature`, quota
- `patternsStore` — pattern library, suggestions, collections, stats
- `marketplaceStore` — marketplace state; currently has no consumer

### `src/lib/stores/` — feature-local, mixed

Classic `svelte/store` writables, consumed **with** the `$` prefix:
`estimation.ts`, `palette.ts`, `patternComparison.ts`, `presets.ts`,
`versions.ts`.

Runes modules, consumed **without** it: `projectOutcomes.svelte.ts`,
`refactoringStore.svelte.ts`, `teamStore.svelte.ts`, `toast.svelte.ts`,
`trendData.svelte.ts`.

**Pattern:** guard every `localStorage` and DOM access with
`import { browser } from '$app/environment'`. Routes are prerendered at build
time, where neither exists. `themeStore` persists under `vibeforge-theme` and
mirrors the value onto `document.documentElement` as `data-theme`.
`workspaceStore`, `contextBlocksStore` and `runsStore` also expose
`syncStatus`, `isOnline`, `hasPendingChanges`, `hasConflicts` and the actions
`forceSyncAll` / `syncPendingChanges`, backed by `src/lib/core/sync/`.


## Component Patterns

### Theme-Aware Styling
Every visual component conditionally applies Tailwind classes based on `themeStore.current`:
```svelte
<script lang="ts">
  import { themeStore } from '$lib/core/stores';
</script>

<div class={`px-4 py-3 ${themeStore.current === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
```
Light theme uses `slate-` colors; dark uses `forge-` colors or `slate-` variants.

### List Components & Filters
- `ContextList.svelte`, `HistoryTable.svelte`, `PatternsList.svelte` accept `blocks`, `activeId`, `onSelect` props
- Use `#each` with `(item.id)` as key for efficient re-renders
- Display empty state when array is empty (see `ContextList.svelte` lines 48–56)

### Multi-Column Layout
- `WorkbenchShell.svelte` — Flex column container that wraps page content
- `+layout.svelte` — Root layout orchestrates `TopBar` + `LeftRailNav` + `StatusBar` + page content
- `LeftRailNav.svelte` — Navigation rail, active route via `$page.url.pathname` from `$app/stores`

### Detail Panels
- `ContextDetailPanel.svelte`, `HistoryDetailPanel.svelte`, `PatternDetailPanel.svelte` follow the same structure:
  - Accept item ID / data via props
  - Render metadata (tags, timestamps, description)
  - Theme-aware borders and text colors
  - Optional action buttons (delete, edit, share)

## Type System

**Domain types live in `src/lib/core/types/` (barrel: `$lib/core/types`);
feature-local types in `src/lib/types/`.**

`core/types/domain.ts`:
```typescript
export type ContextKind =
  | 'system' | 'design' | 'project' | 'code' | 'workflow' | 'data';
export type ContextSource = 'global' | 'workspace' | 'local';
export interface ContextBlock {
  id: string;
  title: string;
  kind: ContextKind;
  content: string;
  description: string;
  tags: string[];
  isActive: boolean;
  source: ContextSource;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  metadata?: Record<string, unknown>;
}
```

`types/workspace.ts`:
```typescript
export interface WorkspaceSettings {
  defaultEvaluationScale: "1-5" | "1-10";
  requireWinner: boolean;
}
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  status: "active" | "archived";
  models: string[];
  tags: string[];
  settings: WorkspaceSettings;
  stats: WorkspaceStats; // { totalRuns: number; lastRunAt?: string }
}
```

`types/evaluation.ts` defines the Evaluation interfaces. Run and model types
live in `core/types/domain.ts`; `types/run.ts` and `types/context.ts` no
longer exist. Other feature-local types: `outcome.ts`,
`success-prediction.ts`, `team.ts`.

**Pattern:** Use discriminated unions for status/kind fields; always include ISO timestamps for sort/filter.

## Routing & Pages

SvelteKit file-based routing (each is a `+page.svelte` in its own directory):
- `/` — Main workbench (3-column: ContextColumn + PromptColumn + OutputColumn)
- `/contexts` — Context library browser and management
- `/patterns` — Prompt patterns / recipes library
- `/history` — Run history, replay, and comparison metrics
- `/evals` — Evaluations dashboard and model comparison
- `/analytics` — Cost and usage analytics
- `/workspaces` — Multi-workspace management with stats and quick switching
- `/dashboard` — Project dashboard
- `/teams` — Team dashboard
- `/refactoring` — Automated refactoring
- `/settings` — User preferences
- `/login` — Sign-in page

The first seven appear in `LeftRailNav`; `/settings` and `/login` are reached
from `TopBar`. `/quick-run` and `/presets` were retired — their pages now live
in `src/archive/retired-routes/`, outside the route tree, and are not routes.

**Reusable layout:** `src/routes/+layout.svelte` orchestrates `TopBar` +
`LeftRailNav` + `StatusBar` + `WorkbenchShell`

## Build & Deployment

**Build Output:** `vite build` → `build/` directory, via **`adapter-static`**
with `pages`/`assets` set to `build` and `prerender = true` in
`src/routes/+layout.ts`. This is not optional: VibeForge ships as a Tauri
desktop app and `src-tauri/tauri.conf.json` names `frontendDist: "../build"`,
read at compile time. `adapter-auto` writes nothing when it detects no hosting
platform, which left the desktop binary unbuildable. `trailingSlash` stays
`never` (writing `settings.html`) to match Tauri's asset resolver, and
`strict` stays `true` with no `fallback`, so a route that fails to prerender
fails the build.

**Artifact gate:** `pnpm verify:artifact` serves `build/` and checks every
route declared in `src/routes/`. Run it after any change touching routes,
navigation or components.

**Tailwind:** Using Tailwind v4 via `@tailwindcss/vite` plugin in `vite.config.ts`. All CSS imports via `@import "tailwindcss"` in `app.css`. Theme tokens defined in `@theme` block (lines 1–28 of `app.css`).

**SSR Hydration:** Stores use `browser` checks; locale storage access only in browser context.

## Feature Patterns

### Main Workbench
- **`/`** — the 3-column professional interface for structured, persistent
  work with full context management. `ContextColumn` + `PromptColumn` +
  `OutputColumn`, from `$lib/workbench/{context,prompt,output}/`.
- Quick Run was retired. There is no `/quick-run` route and no
  `components/quickrun/` directory; the old page sits in
  `src/archive/retired-routes/quick-run/` for reference only. Do not add a
  third path to the workbench under a Quick Run label.

### Presets
- A **Preset** is a saved configuration: `basePrompt` + `contextRefs`
  (`{id, label}[]`) + `models` + metadata.
- `src/lib/stores/presets.ts` is a classic writable store, so read it with the
  `$` prefix. It is consumed by `workbench/prompt/PromptEditor.svelte`,
  `workbench/prompts/PromptSelector.svelte` and the root layout.
- **There is no dedicated presets UI.** `PresetsDrawer`, `SavePresetModal`,
  `PresetDetailPanel` and the `/presets` route were all retired. Build any new
  presets surface against the store, not against those components.

### Workspaces
- **Workspace** entity: container for contexts, settings and run stats.
- Types in `src/lib/types/workspace.ts`; state in
  `workspaceStore` (`$lib/core/stores`).
- UI in `src/lib/components/workspaces/` (`WorkspacesList`,
  `WorkspaceDetailPanel`, `WorkspaceEditorDrawer`).
- Pattern: 2-column layout on desktop (list + detail), single column on mobile.

### Settings Screen
`/settings` is composed of sections in `src/lib/components/settings/`:
`SettingsHeader`, `WorkspaceSettingsSection`, `AppearanceSettingsSection`
(theme only — dark/light/system via `themeStore`; the font-size
`accessibilityStore` was removed), `ModelSettingsSection`,
`ModelRoutingSettingsSection`, `LLMSettingsSection`, `DataSettingsSection`,
`AboutSettingsSection`.

## Critical Notes for Agents

1. **Know which store layer you are in** — `*.svelte.ts` means runes: read
   `store.prop`, call `store.action()`, never `$store`. A classic writable in
   `src/lib/stores/` still needs `$`.
2. **Never mutate store state from outside** — call the action the store
   exports (`contextBlocksStore.addBlock(b)`), not
   `contextBlocksStore.blocks.push(b)`.
3. **Derive inside the store module** — put `$derived` next to the `$state` it
   reads and expose it with a getter.
4. **Guard browser APIs** — wrap `localStorage` and `document` access in
   `if (browser)` from `$app/environment`. Every route is prerendered, so this
   code runs at build time where neither exists.
5. **Theme propagates globally** — `themeStore.setTheme()` writes
   `localStorage` and the `data-theme` attribute; components only read
   `themeStore.current`.
6. **Active contexts** — `contextBlocksStore.activeBlocks` is a derived getter
   over `blocks` filtered on `isActive`. Toggle with
   `contextBlocksStore.toggleActive(id)`; do not maintain a parallel list.
7. **Component prop patterns** — most list/detail components follow the
   `blocks`, `activeId`, `onSelect` convention. Use callback props, never
   `createEventDispatcher`.
8. **Timestamps** — ISO 8601 strings. `ContextBlock` carries `createdAt` and
   `updatedAt`; there is no `lastUpdated` field.
9. **Token estimation** — naive (`length / 4`) in `promptStore.estimatedTokens`;
   keep it simple unless integrating a real tokenizer.
10. **Workspace stats are display-only** — `totalRuns` and `lastRunAt` derive
    from run history; do not mutate them directly.
11. **Routes are a build-time contract** — adding, renaming or removing a
    route, a `goto()` target or an `href` changes what
    `pnpm verify:artifact` checks. Run it, and `pnpm run check`, before
    claiming a change works.
12. **`src/archive/` is dead code** — outside the route tree and excluded from
    `svelte-check` by `tsconfig.json`. Never import from it, and do not treat
    anything there as a live surface.
