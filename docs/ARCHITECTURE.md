# VibeForge Architecture

Technical architecture, design patterns, and component structure for VibeForge.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Component Architecture](#component-architecture)
5. [State Management](#state-management)
6. [Design System](#design-system)
7. [Routing & Navigation](#routing--navigation)
8. [Data Flow](#data-flow)
9. [Design Patterns](#design-patterns)

---

## System Architecture

### Core Philosophy

VibeForge is built on three foundational principles:

1. **3-Column Layout Philosophy**

   - **Left Column (Context):** Reusable prompt components and context blocks
   - **Center Column (Prompt):** Main prompt editor with real-time composition
   - **Right Column (Output):** Model responses and execution history
   - This layout ensures low cognitive load and professional workflows

2. **Structured Context Management**

   - Prompt engineers can compose complex prompts by layering different context types
   - Each context block is independently manageable and versioned
   - System prompts, design specifications, project context, and code snippets are all composable

3. **Execution & History Tracking**
   - Every prompt execution is logged with metadata
   - Users can compare model outputs, review iterations, and build evaluation metrics
   - Full audit trail of what was sent and what was received

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     VibeForge Application                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Context    │  │    Prompt    │  │    Output    │     │
│  │   Column     │  │   Column     │  │   Column     │     │
│  │              │  │              │  │              │     │
│  │ - Library    │  │ - Editor     │  │ - Responses  │     │
│  │ - Search     │  │ - Chips      │  │ - History    │     │
│  │ - Filter     │  │ - Tokens     │  │ - Compare    │     │
│  │ - Preview    │  │ - Compose    │  │ - Evals      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Navigation Sidebar  │  Top Bar (Theme, Settings, Help)    │
├─────────────────────────────────────────────────────────────┤
│        State Management (Svelte 5 runes, core/stores)       │
│  - Workspace   - Context Blocks  - Prompt    - Models       │
│  - Runs        - Tools           - Theme     - License      │
│  - Patterns                                                 │
├─────────────────────────────────────────────────────────────┤
│                    Supporting Pages                         │
│  - Contexts    - Patterns   - History    - Evaluations      │
│  - Analytics   - Workspaces - Dashboard  - Teams            │
│  - Refactoring - Settings   - Login                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend Framework

- **SvelteKit 2.x** - Full-stack metaframework for Svelte
- **Svelte 5.43** - Latest version with runes (`$state`, `$derived`, `$props`)
- **TypeScript 5.9** - Full type safety throughout

### Styling & UI

- **Tailwind CSS v4** - Utility-first CSS framework via `@tailwindcss/vite`
- **Custom Forge Design System** - Dark-by-default theme inspired by forged steel
- **Responsive Design** - Mobile-first, works from mobile to 4K displays

### Build & Development

- **Vite 7.x** - Lightning-fast build tool and dev server
- **pnpm** - Fast, disk space efficient package manager
- **TypeScript** - Compile-time type checking throughout

### Architecture Patterns

- **File-based Routing** - SvelteKit's automatic page routing
- **Store-based State** - Svelte 5 runes stores in `src/lib/core/stores`
- **Component Composition** - Modular, reusable UI components
- **Callback Props Pattern** - No event dispatchers, use callback props instead
- **Server-Side Rendering** - SSR-ready with browser compatibility

### Browser Support

- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- ES2020+ JavaScript support required
- CSS Grid and Flexbox support required

---

## Project Structure

```
vibeforge/
├── src/
│   ├── routes/                    # SvelteKit pages (file-based routing)
│   │   ├── +layout.svelte         # Root layout with nav, theme, shells
│   │   ├── +page.svelte           # Main workbench (3-column)
│   │   ├── analytics/             # Cost and usage analytics
│   │   ├── contexts/              # Context library browser
│   │   ├── dashboard/             # Project dashboard
│   │   ├── evals/                 # Model evaluation dashboard
│   │   ├── history/               # Run history & replay
│   │   ├── login/                 # Sign-in page
│   │   ├── patterns/              # Prompt patterns library
│   │   ├── refactoring/           # Automated refactoring
│   │   ├── settings/              # User preferences
│   │   ├── teams/                 # Team dashboard
│   │   └── workspaces/            # Multi-workspace management
│   │
│   ├── lib/
│   │   ├── ui/layout/             # App shell
│   │   │   ├── TopBar.svelte
│   │   │   ├── LeftRailNav.svelte
│   │   │   ├── StatusBar.svelte
│   │   │   └── WorkbenchShell.svelte
│   │   │
│   │   ├── workbench/             # The 3-column workbench
│   │   │   ├── context/           # ContextColumn
│   │   │   ├── prompt/            # PromptColumn, editor, actions
│   │   │   ├── output/            # OutputColumn, streaming
│   │   │   ├── components/        # Wizard, QuickCreate, scaffolding
│   │   │   ├── planning/          # Multi-model planning
│   │   │   └── stores/            # Wizard and project state
│   │   │
│   │   ├── components/            # Feature UI
│   │   │   ├── context/           # Context library panels
│   │   │   ├── ingest/            # Document ingestion
│   │   │   ├── history/           # History & replay
│   │   │   ├── evaluations/       # Evaluation components
│   │   │   ├── patterns/          # Pattern library
│   │   │   ├── refactoring/       # Refactoring UI
│   │   │   ├── settings/          # Settings panel
│   │   │   ├── team/              # Team dashboard
│   │   │   └── workspaces/        # Workspace components
│   │   │
│   │   ├── core/                  # Application core
│   │   │   ├── stores/            # Svelte 5 runes stores
│   │   │   ├── api/               # NeuroForge / DataForge clients
│   │   │   ├── types/             # Domain types
│   │   │   ├── sync/              # Offline sync, IndexedDB
│   │   │   ├── mcp/               # MCP tool manager
│   │   │   └── execution/         # Run execution
│   │   │
│   │   ├── stores/                # Feature-local stores
│   │   ├── types/                 # Feature-local types
│   │   ├── services/              # Service clients
│   │   ├── refactoring/           # Refactoring engine
│   │   └── data/                  # Architecture pattern templates
│   │
│   ├── app.css                    # Global styles & Tailwind
│   ├── app.d.ts                   # Type definitions
│   ├── app.html                   # HTML shell
│   └── vite-env.d.ts
│
├── static/                        # Static assets
├── svelte.config.js               # Svelte config
├── tailwind.config.cjs.bak        # Tailwind theme extensions
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite config
└── package.json                   # Dependencies
```

---

## Component Architecture

### Layout Components

The app shell lives in `src/lib/ui/layout/` and is exported from
`$lib/ui/layout`.

#### `LeftRailNav.svelte` (Navigation Rail)

- Fixed left sidebar (224px / `w-56`)
- Emoji-based navigation icons
- Active route highlighting
- Links to all major features
- Collapsible on mobile

#### `TopBar.svelte` (Header Bar)

- Fixed top bar with application title
- Theme toggle button
- Settings link
- Help/documentation link
- Search functionality (future)

#### `WorkbenchShell.svelte` (Content Wrapper)

- Flex container for page content
- Padding and spacing
- Responsive to sidebar state
- Dark/light mode support

#### `StatusBar.svelte` (Footer Bar)

- Optional footer for status information
- Token counts, run status
- Model indicators

### Column Components (Main Workbench)

#### `ContextColumn.svelte` (Left Column) — `$lib/workbench/context/`

- Displays available context blocks
- Drag-to-reorder capability
- "Active" context highlighting
- Quick preview on hover
- Tag display

#### `PromptColumn.svelte` (Center Column) — `$lib/workbench/prompt/`

- Textarea for prompt composition
- Active context chips (visual)
- Character/token counter
- Copy/paste helpers
- Send button integration

#### `OutputColumn.svelte` (Right Column) — `$lib/workbench/output/`

- Display area for model responses
- History list (scrollable)
- Response metadata (model, time, tokens)
- Compare responses
- Copy output functionality

### Feature Panels

#### Drawer Components

- All drawers slide from sidebar or slide-out from edges

#### Modal Components

- `UploadIngestModal.svelte` - File upload interface
- Form modals for creating contexts, workspaces, evaluations

#### List Components

- Consistent table layouts for history, patterns, presets
- Sortable columns
- Filtering and search
- Pagination (where applicable)
- Empty states

---

## State Management

### Two store layers, two idioms

State lives in two places, and they do not share a convention. Knowing which
you are touching matters, because the consumption syntax differs.

**`src/lib/core/stores/` — Svelte 5 runes.** The application's primary state.
Each module holds a `$state` object, derives from it with `$derived`, and
exports a single object whose getters expose that state and whose remaining
properties are plain action functions. There is no `subscribe`, and **no `$`
prefix at the call site**:

```typescript
// src/lib/core/stores/theme.svelte.ts (abridged)
const state = $state<{ current: Theme }>({ current: initialTheme });
const isDark = $derived(state.current === 'dark');

function toggle() { setTheme(state.current === 'dark' ? 'light' : 'dark'); }

export const themeStore = {
  get current() { return state.current; },
  get isDark() { return isDark; },
  toggle,
  setTheme,
};
```

All of them are re-exported from `$lib/core/stores`:

| Store | Responsibility |
|---|---|
| `workspaceStore` | Workspaces, current selection, settings, sync status |
| `contextBlocksStore` | Context block library, active selection, token totals |
| `promptStore` | Prompt text, variables, templates, resolved prompt |
| `modelsStore` | Available models, selection, cost estimation |
| `runsStore` | Run history, execution lifecycle, cost and token totals |
| `toolsStore` | MCP servers, tools, invocations |
| `themeStore` | Dark/light theme, persisted to localStorage |
| `licenseStore` | Tier, trial state, feature gating, quota |
| `patternsStore` | Pattern library, suggestions, collections, stats |
| `marketplaceStore` | Pattern marketplace state (no consumer at present) |

**`src/lib/stores/` — feature-local, mixed.** Five modules are classic
`svelte/store` writables consumed with the `$` prefix (`estimation.ts`,
`palette.ts`, `patternComparison.ts`, `presets.ts`, `versions.ts`); five are
runes modules consumed without it (`projectOutcomes.svelte.ts`,
`refactoringStore.svelte.ts`, `teamStore.svelte.ts`, `toast.svelte.ts`,
`trendData.svelte.ts`). The `.svelte.ts` suffix is the reliable signal: it
means runes.

### Store usage

```svelte
<script lang="ts">
  // runes store: read properties directly, call actions as methods
  import { themeStore, promptStore } from '$lib/core/stores';
  // classic writable: still needs the $ prefix
  import { presets } from '$lib/stores/presets';

  const dark = $derived(themeStore.isDark);
</script>

<div class={dark ? 'bg-slate-900' : 'bg-white'}>
  <textarea
    value={promptStore.text}
    oninput={(e) => promptStore.setText(e.currentTarget.value)}
  />
  <span>{promptStore.estimatedTokens} tokens</span>
  <span>{$presets.length} presets</span>
</div>

<button onclick={themeStore.toggle}>Toggle Theme</button>
```

### Persistence and sync

`themeStore` persists to `localStorage` under `vibeforge-theme` and mirrors the
value onto `document.documentElement` as `data-theme`. `workspaceStore`,
`contextBlocksStore` and `runsStore` additionally expose sync state
(`syncStatus`, `isOnline`, `hasPendingChanges`, `hasConflicts`) and actions
(`forceSyncAll`, `syncPendingChanges`) backed by `src/lib/core/sync/`.


## Design System

### Forge Color Palette

#### Dark Mode (Default)

**Backgrounds:**

- `forge-blacksteel: #0B0F17` - Primary backgrounds
- `forge-gunmetal: #111827` - Secondary backgrounds
- `forge-steel: #1E293B` - Interactive states

**Text:**

- `forge-textBright: #F8FAFC` - Primary text
- `forge-textDim: #CBD5E1` - Secondary text
- `forge-textMuted: #94A3B8` - Tertiary text

**Borders:**

- `forge-line: #233044` - Borders and dividers

#### Light Mode

**Backgrounds:**

- `forge-quench: #F8FAFC` - Primary backgrounds
- `forge-quenchLift: #E2E8F0` - Secondary backgrounds

**Text:**

- Light slate variants for text hierarchy

#### Accent Colors

- `forge-ember: #FBBF24` - Primary action/highlight (amber)
- `forge-emberHover: #F59E0B` - Hover state
- `forge-info: #3B82F6` - Information (blue)
- `forge-danger: #EF4444` - Errors/destructive (red)
- `forge-success: #22C55E` - Success states (green)

### Theme Implementation

All components check the `$theme` store and apply conditional Tailwind classes:

```svelte
<script lang="ts">
  import { themeStore } from '$lib/core/stores';
</script>

<div class={`px-4 py-3 ${
  themeStore.current === 'dark'
    ? 'bg-slate-900 text-slate-100 border-slate-700'
    : 'bg-white text-slate-900 border-slate-200'
}`}>
  Content
</div>
```

### Typography

- **Font Family:** System font stack (SF Pro, Segoe UI, Roboto, etc.)
- **Font Sizes:** Tailwind's default scale (text-sm, text-base, text-lg, etc.)
- **Line Heights:** Optimized for readability (leading-relaxed for body text)

### Spacing

- **Consistent spacing:** Tailwind's spacing scale (4px increments)
- **Component padding:** `p-4` (16px) for most components
- **Section gaps:** `gap-6` (24px) between major sections

---

## Routing & Navigation

### File-based Routing

SvelteKit uses file-based routing. Each `+page.svelte` file in `src/routes/` becomes a route:

```
src/routes/
├── +page.svelte           → /
├── contexts/+page.svelte  → /contexts
├── history/+page.svelte   → /history
└── settings/+page.svelte  → /settings
```

### Layout Hierarchy

```
+layout.svelte (root)
├── TopBar
├── LeftRailNav
├── StatusBar
└── <slot /> (page content)
    ├── +page.svelte (/)
    ├── contexts/+page.svelte
    └── ...
```

### Navigation Pattern

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
</script>

<!-- Active route highlighting -->
<a
  href="/contexts"
  class={$page.url.pathname === '/contexts' ? 'active' : ''}
>
  Contexts
</a>

<!-- Programmatic navigation -->
<button on:click={() => goto('/history')}>
  View History
</button>
```

---

## Data Flow

### Prompt Execution Flow

```
1. User composes prompt in PromptColumn
   ↓
2. User selects context blocks from ContextColumn
   ↓
3. contextBlocksStore.toggleActive() marks the blocks to include
   ↓
4. User clicks "Run" button
   ↓
5. runsStore.execute() calls the NeuroForge client in core/api
   ↓
6. Response received
   ↓
7. runsStore.addRun() saves to history
   ↓
8. OutputColumn displays response
   ↓
9. User can replay, compare, or evaluate
```

### Context Management Flow

```
1. User uploads document via UploadIngestModal
   ↓
2. Document queued in IngestQueuePanel
   ↓
3. Backend processes document (chunking, embedding)
   ↓
4. Context blocks created via contextBlocksStore.addBlock()
   ↓
5. User can search/filter contexts in ContextColumn
   ↓
6. User selects context for use in prompt
   ↓
7. contextBlocksStore.toggleActive() adds it to activeBlocks
```

---

## Design Patterns

### Component Patterns

#### 1. Callback Props (No Event Dispatchers)

**❌ Don't use event dispatchers:**

```svelte
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>
<button on:click={() => dispatch('save')}>Save</button>
```

**✅ Use callback props:**

```svelte
<script lang="ts">
  let { onSave }: { onSave: () => void } = $props();
</script>
<button on:click={onSave}>Save</button>
```

#### 2. Svelte 5 Runes

**Use modern Svelte 5 runes:**

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { title, description } = $props();
</script>
```

#### 3. TypeScript Props

**Always type component props:**

```svelte
<script lang="ts">
  import type { ContextBlock } from '$lib/core/types';

  let {
    context,
    onSelect
  }: {
    context: ContextBlock;
    onSelect: (id: string) => void;
  } = $props();
</script>
```

### State Management Patterns

#### 1. Store Mutations

**Always use exported functions for mutations:**

```typescript
// ❌ Don't reach into a store's state
contextBlocksStore.blocks.push(newBlock);

// ✅ Use the action the store exports
contextBlocksStore.addBlock(newBlock);
```

#### 2. Derived Stores

**Use `$derived` inside the store module, and expose it with a getter:**

```typescript
// in a *.svelte.ts store module
const state = $state({ text: '' });
const estimatedTokens = $derived(Math.ceil(state.text.length / 4));

export const promptStore = {
  get text() { return state.text; },
  get estimatedTokens() { return estimatedTokens; },
};
```

#### 3. Store Persistence

**Persist important stores to localStorage:**

```typescript
import { browser } from '$app/environment';

const STORAGE_KEY = 'vibeforge-theme';
const initial = browser
  ? (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark'
  : 'dark';

const state = $state<{ current: Theme }>({ current: initial });

function setTheme(theme: Theme) {
  state.current = theme;
  if (browser) {
    localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
}
```

Guard every `localStorage` and `document` access with `browser`: routes are
prerendered at build time, where neither exists.

---

## Performance Considerations

### Code Splitting

- SvelteKit automatically code-splits by route
- Each page is a separate chunk
- Lazy load heavy components when needed

### Reactivity Optimization

- Use `$derived` for computed values (auto-memoized)
- Avoid unnecessary store subscriptions
- Use `$effect` sparingly (only for side effects)

### Bundle Size

- Production artifact: 85 files. All JavaScript chunks together gzip to
  roughly 406 KB, stylesheets to roughly 27 KB; SvelteKit splits these by
  route, so no single page loads all of it. Measure with `pnpm build`
  rather than trusting this figure.
- Tailwind CSS purged in production
- No heavy dependencies (Svelte is lightweight)

---

**For more details, see:**

- [FEATURES.md](./FEATURES.md) - Feature documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development workflows
- [TESTING.md](./TESTING.md) - Testing procedures
