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
│              State Management (Svelte Stores)              │
│  - Theme Store      - Context Store    - Run Store         │
│  - Prompt Store     - Preset Store     - Accessibility    │
├─────────────────────────────────────────────────────────────┤
│                  Supporting Pages                          │
│  - Quick Run       - History        - Patterns             │
│  - Presets         - Evaluations    - Workspaces           │
│  - Settings        - Document Ingestion                    │
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
- **Store-based State** - Centralized state management with Svelte stores
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
│   │   ├── contexts/              # Context library browser
│   │   ├── evals/                 # Model evaluation dashboard
│   │   ├── history/               # Run history & replay
│   │   ├── patterns/              # Prompt patterns library
│   │   ├── presets/               # Saved configurations
│   │   ├── quick-run/             # Quick experiment mode
│   │   ├── settings/              # User preferences
│   │   └── workspaces/            # Multi-workspace management
│   │
│   ├── lib/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ContextColumn.svelte
│   │   │   ├── PromptColumn.svelte
│   │   │   ├── OutputColumn.svelte
│   │   │   ├── ForgeSideNav.svelte
│   │   │   ├── ForgeTopBar.svelte
│   │   │   ├── WorkbenchShell.svelte
│   │   │   ├── research/          # Research & Assist panel
│   │   │   ├── ingest/            # Document ingestion
│   │   │   ├── context/           # Context management
│   │   │   ├── history/           # History & replay
│   │   │   ├── evaluations/       # Evaluation components
│   │   │   ├── patterns/          # Pattern library
│   │   │   ├── settings/          # Settings panel
│   │   │   └── workspaces/        # Workspace components
│   │   │
│   │   ├── stores/                # Svelte state management
│   │   │   ├── themeStore.ts      # Dark/light theme
│   │   │   ├── promptStore.ts     # Active prompt state
│   │   │   ├── contextStore.ts    # Context blocks library
│   │   │   ├── runStore.ts        # Model run history
│   │   │   ├── presetsStore.ts    # Saved configurations
│   │   │   └── accessibilityStore.ts
│   │   │
│   │   ├── types/                 # TypeScript interfaces
│   │   │   ├── context.ts
│   │   │   ├── evaluation.ts
│   │   │   ├── run.ts
│   │   │   └── workspace.ts
│   │   │
│   │   └── index.ts               # Export central
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

#### `ForgeSideNav.svelte` (Navigation Sidebar)

- Fixed left sidebar (224px / `w-56`)
- Emoji-based navigation icons
- Active route highlighting
- Links to all major features
- Collapsible on mobile

#### `ForgeTopBar.svelte` (Header Bar)

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

#### `ContextColumn.svelte` (Left Column)

- Displays available context blocks
- Drag-to-reorder capability
- "Active" context highlighting
- Quick preview on hover
- Tag display

#### `PromptColumn.svelte` (Center Column)

- Textarea for prompt composition
- Active context chips (visual)
- Character/token counter
- Copy/paste helpers
- Send button integration

#### `OutputColumn.svelte` (Right Column)

- Display area for model responses
- History list (scrollable)
- Response metadata (model, time, tokens)
- Compare responses
- Copy output functionality

### Feature Panels

#### Drawer Components

- `ResearchAssistDrawer.svelte` - Research notes, snippets, suggestions
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

### Svelte Stores Architecture

All stores use Svelte's `writable` and derived stores. They follow a consistent pattern:

```typescript
import { writable, derived } from "svelte/store";

// Define store with initial value
const storeState = writable<StateType>(initialValue);

// Create public store for readonly access
export const store = { subscribe: storeState.subscribe };

// Export methods for mutations
export function updateStore(newValue: StateType) {
  storeState.set(newValue);
}
```

### Core Stores

#### `themeStore.ts`

- **Purpose:** Manage dark/light theme state
- **State:** `Theme` ('dark' | 'light')
- **Methods:** `toggleTheme()`, `setTheme(theme)`
- **Persistence:** localStorage

#### `promptStore.ts`

- **Purpose:** Active prompt composition state
- **State:** `PromptState` (text, activeContexts, tokenCount)
- **Methods:** `updatePrompt()`, `addContext()`, `removeContext()`, `clearPrompt()`
- **Derived:** `tokenCount` (estimated from character count)

#### `contextStore.ts`

- **Purpose:** Context blocks library
- **State:** `ContextBlock[]`
- **Methods:** `addContext()`, `updateContext()`, `deleteContext()`, `searchContexts()`
- **Derived:** `contextCount`, `contextsByType`

#### `runStore.ts`

- **Purpose:** Model run history
- **State:** `RunHistory[]`
- **Methods:** `addRun()`, `getRun(id)`, `deleteRun()`, `clearHistory()`
- **Derived:** `runCount`, `recentRuns`

#### `presetsStore.ts`

- **Purpose:** Saved workbench configurations
- **State:** `Preset[]`
- **Methods:** `savePreset()`, `loadPreset()`, `deletePreset()`, `pinPreset()`
- **Derived:** `pinnedPresets`

#### `accessibilityStore.ts`

- **Purpose:** Accessibility preferences
- **State:** `AccessibilitySettings` (fontSize, reducedMotion, highContrast)
- **Methods:** `updateSettings()`
- **Persistence:** localStorage

### Store Usage Pattern

```svelte
<script lang="ts">
  import { theme, toggleTheme } from '$lib/stores/themeStore';
  import { promptStore, updatePrompt } from '$lib/stores/promptStore';
</script>

<!-- Reactive to store changes -->
<div class={$theme === 'dark' ? 'bg-slate-900' : 'bg-white'}>
  <textarea value={$promptStore.text} on:input={(e) => updatePrompt(e.target.value)} />
</div>

<button on:click={toggleTheme}>Toggle Theme</button>
```

---

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
  import { theme } from '$lib/stores/themeStore';
</script>

<div class={`px-4 py-3 ${
  $theme === 'dark'
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
├── ForgeSideNav
├── ForgeTopBar
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
3. promptStore updates with active contexts
   ↓
4. User clicks "Run" button
   ↓
5. API call to backend (future: /api/run)
   ↓
6. Response received
   ↓
7. runStore.addRun() saves to history
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
4. Context blocks created and added to contextStore
   ↓
5. User can search/filter contexts in ContextColumn
   ↓
6. User selects context for use in prompt
   ↓
7. Context added to promptStore.activeContexts
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
  import type { ContextBlock } from '$lib/types/context';

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
// ❌ Don't mutate store directly
$contextStore.push(newContext);

// ✅ Use exported function
addContext(newContext);
```

#### 2. Derived Stores

**Use derived stores for computed values:**

```typescript
export const tokenCount = derived(promptStore, ($prompt) => {
  return Math.ceil($prompt.text.length / 4);
});
```

#### 3. Store Persistence

**Persist important stores to localStorage:**

```typescript
const stored = localStorage.getItem("theme");
const initialTheme = stored ? JSON.parse(stored) : "dark";

const themeState = writable<Theme>(initialTheme);

themeState.subscribe((value) => {
  localStorage.setItem("theme", JSON.stringify(value));
});
```

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

- Current bundle size: ~150KB (gzipped)
- Tailwind CSS purged in production
- No heavy dependencies (Svelte is lightweight)

---

**For more details, see:**

- [FEATURES.md](./FEATURES.md) - Feature documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development workflows
- [TESTING.md](./TESTING.md) - Testing procedures
