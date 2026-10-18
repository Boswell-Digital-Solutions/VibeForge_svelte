import { describe, expect, it, vi } from 'vitest';

// A browser cannot load Node's crypto built-in. Keep this boundary explicit.
vi.mock('crypto', () => { throw new Error('Node crypto is unavailable in the browser'); });

describe('prediction cache browser boundary', () => {
	it('loads and exposes an empty cache without Node crypto', async () => {
		const { predictionCache } = await import('$lib/utils/predictionCache');
		predictionCache.clear();
		expect(predictionCache.getStats().size).toBe(0);
	});
});
