/**
 * VF-310 + VF-313: Patterns Store
 *
 * Svelte 5 runes store for managing prompt patterns with:
 * - Built-in patterns library integration
 * - Custom pattern creation/editing
 * - Pattern filtering and search
 * - localStorage persistence
 * - Usage tracking and ratings
 * - AI-powered pattern suggestions (VF-313)
 */

import type {
	PromptPattern,
	PatternFilters,
	PatternRating,
	PatternCollection,
	PatternMatchResult,
	PatternSuggestion
} from '../types/patterns';
import {
	extractVariables,
	substituteVariables,
	validatePattern,
	createBlankPattern
} from '../types/patterns';
import {
	BUILTIN_PATTERNS,
	getPatternById,
	getPatternsByCategory,
	getPatternsByTag,
	searchPatterns
} from '../patterns/builtinPatterns';
import { patternMatcher } from '../llm/patternMatcher';

/**
 * Patterns Store State
 */
interface PatternsState {
	/** All patterns (built-in + custom) */
	patterns: PromptPattern[];
	/** Currently selected pattern */
	selectedPattern: PromptPattern | null;
	/** Currently editing pattern */
	editingPattern: PromptPattern | null;
	/** Pattern ratings */
	ratings: PatternRating[];
	/** Pattern collections */
	collections: PatternCollection[];
	/** Current filter settings */
	filters: PatternFilters;
	/** Is loading patterns? */
	isLoading: boolean;
	/** Error message */
	error: string | null;
	/** VF-313: Current pattern suggestions */
	currentSuggestions: PatternSuggestion[];
	/** VF-313: Last match result */
	lastMatchResult: PatternMatchResult | null;
	/** VF-313: Is analyzing prompt? */
	isAnalyzing: boolean;
}

const STORAGE_KEY = 'vibeforge-patterns';
const RATINGS_KEY = 'vibeforge-pattern-ratings';
const COLLECTIONS_KEY = 'vibeforge-pattern-collections';

// Helper to load from localStorage
function loadFromStorage<T>(key: string, fallback: T): T {
	if (typeof window === 'undefined') return fallback;
	try {
		const stored = localStorage.getItem(key);
		return stored ? JSON.parse(stored) : fallback;
	} catch (err) {
		console.error(`Failed to load ${key} from localStorage:`, err);
		return fallback;
	}
}

// Helper to save to localStorage
function saveToStorage<T>(key: string, data: T): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(data));
	} catch (err) {
		console.error(`Failed to save ${key} to localStorage:`, err);
	}
}

// Load custom patterns from localStorage
const customPatterns = loadFromStorage<PromptPattern[]>(STORAGE_KEY, []);
const storedRatings = loadFromStorage<PatternRating[]>(RATINGS_KEY, []);
const storedCollections = loadFromStorage<PatternCollection[]>(
	COLLECTIONS_KEY,
	[]
);

// Initialize state
const state = $state<PatternsState>({
	patterns: [...BUILTIN_PATTERNS, ...customPatterns],
	selectedPattern: null,
	editingPattern: null,
	ratings: storedRatings,
	collections: storedCollections,
	filters: {},
	isLoading: false,
	error: null,
	// VF-313: AI Pattern Suggestions
	currentSuggestions: [],
	lastMatchResult: null,
	isAnalyzing: false
});

/**
 * Derived: Filtered patterns based on current filters
 */
const filteredPatterns = $derived.by(() => {
	let filtered = state.patterns;

	// Apply search query
	if (state.filters.query && state.filters.query.trim()) {
		const query = state.filters.query.toLowerCase();
		filtered = filtered.filter(
			(p) =>
				p.name.toLowerCase().includes(query) ||
				p.description.toLowerCase().includes(query) ||
				p.tags.some((tag) => tag.toLowerCase().includes(query))
		);
	}

	// Apply category filter
	if (state.filters.category) {
		filtered = filtered.filter((p) => p.category === state.filters.category);
	}

	// Apply tags filter (match any)
	if (state.filters.tags && state.filters.tags.length > 0) {
		filtered = filtered.filter((p) =>
			state.filters.tags!.some((tag) => p.tags.includes(tag))
		);
	}

	// Apply author filter
	if (state.filters.author) {
		filtered = filtered.filter((p) => p.author === state.filters.author);
	}

	// Apply built-in only filter
	if (state.filters.builtInOnly) {
		filtered = filtered.filter((p) => p.isBuiltIn);
	}

	// Apply public only filter
	if (state.filters.publicOnly) {
		filtered = filtered.filter((p) => p.isPublic);
	}

	// Apply minimum rating filter
	if (state.filters.minRating !== undefined) {
		filtered = filtered.filter(
			(p) =>
				p.averageRating !== undefined &&
				p.averageRating >= state.filters.minRating!
		);
	}

	// Apply sorting
	if (state.filters.sortBy) {
		const direction = state.filters.sortDirection === 'desc' ? -1 : 1;

		filtered = filtered.sort((a, b) => {
			switch (state.filters.sortBy) {
				case 'name':
					return direction * a.name.localeCompare(b.name);
				case 'usage':
					return direction * (a.usageCount - b.usageCount);
				case 'rating':
					return (
						direction *
						((a.averageRating || 0) - (b.averageRating || 0))
					);
				case 'recent':
					return (
						direction *
						(new Date(a.updatedAt).getTime() -
							new Date(b.updatedAt).getTime())
					);
				default:
					return 0;
			}
		});
	}

	return filtered;
});

/**
 * Derived: Custom patterns only
 */
const customPatternsOnly = $derived(state.patterns.filter((p) => !p.isBuiltIn));

/**
 * Derived: Pattern by category counts
 */
const categoryStats = $derived.by(() => {
	const stats: Record<string, number> = {};
	for (const pattern of state.patterns) {
		stats[pattern.category] = (stats[pattern.category] || 0) + 1;
	}
	return stats;
});

/**
 * Derived: All unique tags across patterns
 */
const allTags = $derived.by(() => {
	const tagsSet = new Set<string>();
	for (const pattern of state.patterns) {
		for (const tag of pattern.tags) {
			tagsSet.add(tag);
		}
	}
	return Array.from(tagsSet).sort();
});

/**
 * Actions
 */

/**
 * Select a pattern
 */
function selectPattern(patternId: string): void {
	const pattern = state.patterns.find((p) => p.id === patternId);
	if (pattern) {
		state.selectedPattern = pattern;
	}
}

/**
 * Deselect current pattern
 */
function deselectPattern(): void {
	state.selectedPattern = null;
}

/**
 * Start editing a pattern (existing or new)
 */
function startEditPattern(patternId?: string): void {
	if (patternId) {
		const pattern = state.patterns.find((p) => p.id === patternId);
		if (pattern) {
			// Clone pattern for editing
			state.editingPattern = JSON.parse(JSON.stringify(pattern));
		}
	} else {
		// Create new blank pattern
		state.editingPattern = createBlankPattern();
	}
}

/**
 * Cancel editing
 */
function cancelEdit(): void {
	state.editingPattern = null;
}

/**
 * Save pattern (create or update)
 */
function savePattern(pattern: PromptPattern): void {
	// Validate pattern
	const errors = validatePattern(pattern);
	if (errors.length > 0) {
		state.error = `Pattern validation failed: ${errors.join(', ')}`;
		return;
	}

	// Update timestamps
	pattern.updatedAt = new Date().toISOString();

	// Check if updating existing or creating new
	const existingIndex = state.patterns.findIndex((p) => p.id === pattern.id);

	if (existingIndex >= 0) {
		// Update existing
		pattern.version += 1;
		state.patterns[existingIndex] = pattern;
	} else {
		// Add new
		pattern.createdAt = new Date().toISOString();
		state.patterns = [...state.patterns, pattern];
	}

	// Save custom patterns to localStorage
	saveToStorage(STORAGE_KEY, customPatternsOnly);

	// Clear editing state
	state.editingPattern = null;
	state.error = null;
}

/**
 * Delete a pattern
 */
function deletePattern(patternId: string): void {
	// Don't allow deleting built-in patterns
	const pattern = state.patterns.find((p) => p.id === patternId);
	if (pattern?.isBuiltIn) {
		state.error = 'Cannot delete built-in patterns';
		return;
	}

	// Remove pattern
	state.patterns = state.patterns.filter((p) => p.id !== patternId);

	// Save to localStorage
	saveToStorage(STORAGE_KEY, customPatternsOnly);

	// Deselect if currently selected
	if (state.selectedPattern?.id === patternId) {
		state.selectedPattern = null;
	}

	state.error = null;
}

/**
 * Duplicate a pattern (for customization)
 */
function duplicatePattern(patternId: string): void {
	const pattern = state.patterns.find((p) => p.id === patternId);
	if (!pattern) {
		state.error = 'Pattern not found';
		return;
	}

	// Clone pattern with new ID
	const duplicate: PromptPattern = {
		...JSON.parse(JSON.stringify(pattern)),
		id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		name: `${pattern.name} (Copy)`,
		isBuiltIn: false,
		isPublic: false,
		usageCount: 0,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		version: 1
	};

	// Add to patterns
	state.patterns = [...state.patterns, duplicate];

	// Save to localStorage
	saveToStorage(STORAGE_KEY, customPatternsOnly);

	// Select the duplicate
	state.selectedPattern = duplicate;

	state.error = null;
}

/**
 * Increment pattern usage count
 */
function recordPatternUsage(patternId: string): void {
	const pattern = state.patterns.find((p) => p.id === patternId);
	if (pattern) {
		pattern.usageCount += 1;
		pattern.updatedAt = new Date().toISOString();

		// Save if custom pattern
		if (!pattern.isBuiltIn) {
			saveToStorage(STORAGE_KEY, customPatternsOnly);
		}
	}
}

/**
 * Rate a pattern
 */
function ratePattern(
	patternId: string,
	userId: string,
	stars: number,
	comment?: string
): void {
	// Validate stars
	if (stars < 1 || stars > 5) {
		state.error = 'Rating must be between 1 and 5 stars';
		return;
	}

	// Check if user already rated this pattern
	const existingRating = state.ratings.find(
		(r) => r.patternId === patternId && r.userId === userId
	);

	if (existingRating) {
		// Update existing rating
		existingRating.stars = stars;
		existingRating.comment = comment;
		existingRating.createdAt = new Date().toISOString();
	} else {
		// Add new rating
		const rating: PatternRating = {
			id: `rating_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			patternId,
			userId,
			stars,
			comment,
			createdAt: new Date().toISOString()
		};
		state.ratings = [...state.ratings, rating];
	}

	// Update pattern average rating
	const patternRatings = state.ratings.filter((r) => r.patternId === patternId);
	const avgRating =
		patternRatings.reduce((sum, r) => sum + r.stars, 0) /
		patternRatings.length;

	const pattern = state.patterns.find((p) => p.id === patternId);
	if (pattern) {
		pattern.averageRating = avgRating;
		pattern.ratingCount = patternRatings.length;

		// Save if custom pattern
		if (!pattern.isBuiltIn) {
			saveToStorage(STORAGE_KEY, customPatternsOnly);
		}
	}

	// Save ratings to localStorage
	saveToStorage(RATINGS_KEY, state.ratings);

	state.error = null;
}

/**
 * Update filters
 */
function setFilters(filters: PatternFilters): void {
	state.filters = { ...state.filters, ...filters };
}

/**
 * Clear all filters
 */
function clearFilters(): void {
	state.filters = {};
}

/**
 * Export pattern as JSON
 */
function exportPattern(patternId: string): string {
	const pattern = state.patterns.find((p) => p.id === patternId);
	if (!pattern) {
		throw new Error('Pattern not found');
	}

	const exportData = {
		pattern,
		exportedAt: new Date().toISOString(),
		exportVersion: '1.0' as const
	};

	return JSON.stringify(exportData, null, 2);
}

/**
 * Import pattern from JSON
 */
function importPattern(jsonString: string): void {
	try {
		const imported = JSON.parse(jsonString);

		if (!imported.pattern || imported.exportVersion !== '1.0') {
			throw new Error('Invalid pattern export format');
		}

		const pattern: PromptPattern = imported.pattern;

		// Generate new ID and mark as custom
		pattern.id = `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		pattern.isBuiltIn = false;
		pattern.createdAt = new Date().toISOString();
		pattern.updatedAt = new Date().toISOString();
		pattern.usageCount = 0;

		// Validate pattern
		const errors = validatePattern(pattern);
		if (errors.length > 0) {
			throw new Error(`Invalid pattern: ${errors.join(', ')}`);
		}

		// Add pattern
		state.patterns = [...state.patterns, pattern];

		// Save to localStorage
		saveToStorage(STORAGE_KEY, customPatternsOnly);

		// Select the imported pattern
		state.selectedPattern = pattern;

		state.error = null;
	} catch (err) {
		state.error =
			err instanceof Error ? err.message : 'Failed to import pattern';
	}
}

/**
 * Create a pattern collection
 */
function createCollection(
	name: string,
	description: string,
	patternIds: string[],
	isPublic: boolean = false
): void {
	const collection: PatternCollection = {
		id: `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		name,
		description,
		patternIds,
		author: 'user', // TODO: Get from auth
		isPublic,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	state.collections = [...state.collections, collection];
	saveToStorage(COLLECTIONS_KEY, state.collections);
}

/**
 * Update a collection
 */
function updateCollection(
	collectionId: string,
	updates: Partial<PatternCollection>
): void {
	const collection = state.collections.find((c) => c.id === collectionId);
	if (collection) {
		Object.assign(collection, updates);
		collection.updatedAt = new Date().toISOString();
		saveToStorage(COLLECTIONS_KEY, state.collections);
	}
}

/**
 * Delete a collection
 */
function deleteCollection(collectionId: string): void {
	state.collections = state.collections.filter((c) => c.id !== collectionId);
	saveToStorage(COLLECTIONS_KEY, state.collections);
}

/**
 * VF-313: Suggest patterns based on prompt text
 * @param promptText User's prompt text to analyze
 * @param limit Maximum number of suggestions (default: 5)
 */
function suggestPatterns(promptText: string, limit: number = 5): void {
	if (!promptText || promptText.trim().length < 10) {
		// Clear suggestions for very short prompts
		state.currentSuggestions = [];
		state.lastMatchResult = null;
		return;
	}

	state.isAnalyzing = true;
	state.error = null;

	try {
		// Analyze prompt and get suggestions
		const result = patternMatcher.analyzePrompt(promptText, state.patterns, limit);

		// Update state
		state.lastMatchResult = result;
		state.currentSuggestions = result.suggestions;

		// Record suggestions in usage stats
		for (const suggestion of result.suggestions) {
			patternMatcher.recordSuggestion(suggestion.pattern.id);
		}

		state.isAnalyzing = false;
	} catch (err) {
		state.error = err instanceof Error ? err.message : 'Failed to analyze prompt';
		state.isAnalyzing = false;
		state.currentSuggestions = [];
		state.lastMatchResult = null;
	}
}

/**
 * VF-313: Accept a suggested pattern (user clicked apply)
 * @param patternId Pattern ID
 */
function acceptSuggestion(patternId: string): void {
	// Record accept in pattern matcher
	patternMatcher.recordAccept(patternId);

	// Increment pattern usage count
	recordPatternUsage(patternId);

	// Select the pattern
	const pattern = state.patterns.find((p) => p.id === patternId);
	if (pattern) {
		state.selectedPattern = pattern;
	}

	// Clear suggestions after accept
	state.currentSuggestions = [];
	state.lastMatchResult = null;
}

/**
 * VF-313: Reject a suggested pattern (user dismissed)
 * @param patternId Pattern ID
 */
function rejectSuggestion(patternId: string): void {
	// Record reject in pattern matcher
	patternMatcher.recordReject(patternId);

	// Remove from current suggestions
	state.currentSuggestions = state.currentSuggestions.filter(
		(s) => s.pattern.id !== patternId
	);
}

/**
 * VF-313: Clear all current suggestions
 */
function clearSuggestions(): void {
	state.currentSuggestions = [];
	state.lastMatchResult = null;
}

/**
 * VF-313: Get usage stats for a pattern
 * @param patternId Pattern ID
 */
function getPatternStats(patternId: string) {
	return patternMatcher.getStats(patternId);
}

/**
 * VF-313: Reset usage stats for a pattern
 * @param patternId Pattern ID
 */
function resetPatternStats(patternId: string): void {
	patternMatcher.resetStats(patternId);
}

/**
 * VF-313: Reset all pattern usage stats
 */
function resetAllPatternStats(): void {
	patternMatcher.resetAllStats();
}

/**
 * Export the store
 */
export const patternsStore = {
	// State (use $state snapshot)
	get patterns() {
		return state.patterns;
	},
	get selectedPattern() {
		return state.selectedPattern;
	},
	get editingPattern() {
		return state.editingPattern;
	},
	get ratings() {
		return state.ratings;
	},
	get collections() {
		return state.collections;
	},
	get filters() {
		return state.filters;
	},
	get isLoading() {
		return state.isLoading;
	},
	get error() {
		return state.error;
	},
	// VF-313: AI Pattern Suggestions state
	get currentSuggestions() {
		return state.currentSuggestions;
	},
	get lastMatchResult() {
		return state.lastMatchResult;
	},
	get isAnalyzing() {
		return state.isAnalyzing;
	},

	// Derived
	get filteredPatterns() {
		return filteredPatterns;
	},
	get customPatterns() {
		return customPatternsOnly;
	},
	get categoryStats() {
		return categoryStats;
	},
	get allTags() {
		return allTags;
	},

	// Actions
	selectPattern,
	deselectPattern,
	startEditPattern,
	cancelEdit,
	savePattern,
	deletePattern,
	duplicatePattern,
	recordPatternUsage,
	ratePattern,
	setFilters,
	clearFilters,
	exportPattern,
	importPattern,
	createCollection,
	updateCollection,
	deleteCollection,
	// VF-313: AI Pattern Suggestions actions
	suggestPatterns,
	acceptSuggestion,
	rejectSuggestion,
	clearSuggestions,
	getPatternStats,
	resetPatternStats,
	resetAllPatternStats,

	// Utilities (re-export from types)
	extractVariables,
	substituteVariables,
	validatePattern,

	// Built-in pattern helpers
	getPatternById,
	getPatternsByCategory,
	getPatternsByTag,
	searchPatterns
};
