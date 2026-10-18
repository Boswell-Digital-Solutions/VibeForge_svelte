import { beforeEach, describe, expect, it } from 'vitest';
import { comparisonStore } from '$lib/workbench/planning/stores/comparison.svelte';

describe('comparison module boundary', () => {
	beforeEach(() => comparisonStore.clearAllComparisons());

	it('loads synchronously and rejects an undersized comparison without persisting a result', () => {
		const result = comparisonStore.createMultiWayComparison([], 'Invalid request');
		expect(result).toBeUndefined();
		expect(comparisonStore.error).toBe('Multi-way comparison requires at least 3 sessions');
		expect(comparisonStore.currentComparison).toBeNull();
		expect(comparisonStore.comparisonHistory).toEqual([]);
		expect(comparisonStore.isComparing).toBe(false);
	});
});
