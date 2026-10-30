/**
 * VibeForge V2 - License Store
 *
 * Manages freemium licensing with Svelte 5 runes and localStorage persistence.
 */

import { browser } from '$app/environment';
import {
	FeatureFlag,
	TIER_CONFIGS,
	createFreeLicense,
	startTrial,
	hasFeature,
	isTrialExpired,
	getTrialDaysRemaining,
	isLicenseExpired,
	canUseOrchestrator,
	incrementOrchestratorUsage,
	resetMonthlyUsage
} from '$lib/core/types/license';
import type {
	License,
	LicenseTier,
	LicenseValidationResponse
} from '$lib/core/types/license';
import { LICENSE_API_URL } from '$lib/core/api/endpoints';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'vibeforge-license';
const VALIDATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const API_ENDPOINT = LICENSE_API_URL;

// ============================================================================
// LICENSE STATE
// ============================================================================

// Initialize from localStorage or create free license
const initialLicense: License = browser
	? loadLicenseFromStorage() || createFreeLicense()
	: createFreeLicense();

const state = $state<{
	license: License;
	isValidating: boolean;
	validationError: string | null;
}>({
	license: initialLicense,
	isValidating: false,
	validationError: null
});

// ============================================================================
// DERIVED STATE
// ============================================================================

const isFree = $derived(state.license.tier === 'free');
const isTrial = $derived(state.license.tier === 'trial');
const isPro = $derived(state.license.tier === 'pro');
const isEnterprise = $derived(state.license.tier === 'enterprise');

const trialExpired = $derived(isTrialExpired(state.license));
const licenseExpired = $derived(isLicenseExpired(state.license));
const trialDaysRemaining = $derived(getTrialDaysRemaining(state.license));

const canUseOrchestratorDerived = $derived(canUseOrchestrator(state.license));
const canUseCloudExecution = $derived(
	hasFeature(state.license, FeatureFlag.EXECUTION_CLOUD) &&
		!trialExpired &&
		!licenseExpired
);
const canUseModelComparison = $derived(
	hasFeature(state.license, FeatureFlag.MODEL_COMPARISON) &&
		!trialExpired &&
		!licenseExpired
);
const canUseTeamWorkspaces = $derived(
	hasFeature(state.license, FeatureFlag.TEAM_WORKSPACES) && !licenseExpired
);

// Orchestrator quota remaining
const orchestratorQuotaRemaining = $derived.by(() => {
	const limit = state.license.limits.orchestratorRunsPerMonth;
	if (limit === null) return null; // unlimited
	return Math.max(0, limit - state.license.orchestratorUsageThisMonth);
});

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function loadLicenseFromStorage(): License | null {
	if (!browser) return null;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return null;

		const parsed = JSON.parse(stored);

		// Convert date strings back to Date objects
		return {
			...parsed,
			features: new Set(parsed.features), // Restore Set
			expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
			trialEndsAt: parsed.trialEndsAt ? new Date(parsed.trialEndsAt) : null,
			createdAt: new Date(parsed.createdAt),
			lastValidatedAt: parsed.lastValidatedAt ? new Date(parsed.lastValidatedAt) : null
		};
	} catch (error) {
		console.error('Failed to load license from storage:', error);
		return null;
	}
}

function saveLicenseToStorage(license: License) {
	if (!browser) return;

	try {
		const serialized = {
			...license,
			features: Array.from(license.features), // Convert Set to Array
			expiresAt: license.expiresAt?.toISOString() || null,
			trialEndsAt: license.trialEndsAt?.toISOString() || null,
			createdAt: license.createdAt.toISOString(),
			lastValidatedAt: license.lastValidatedAt?.toISOString() || null
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
	} catch (error) {
		console.error('Failed to save license to storage:', error);
	}
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Check if a specific feature is available
 */
function checkFeature(feature: FeatureFlag): boolean {
	return hasFeature(state.license, feature) && !licenseExpired && !trialExpired;
}

/**
 * Start a trial (14 days)
 */
function beginTrial() {
	if (state.license.tier !== 'free') {
		console.warn('Cannot start trial: already on a paid tier or in trial');
		return;
	}

	state.license = startTrial(state.license);
	saveLicenseToStorage(state.license);
}

/**
 * Upgrade to a specific tier (from backend validation)
 */
function upgradeTier(tier: LicenseTier) {
	const config = TIER_CONFIGS[tier];

	state.license = {
		...state.license,
		tier,
		features: new Set(config.features),
		limits: config.limits,
		trialEndsAt: null, // Clear trial when upgrading
		lastValidatedAt: new Date()
	};

	saveLicenseToStorage(state.license);
}

/**
 * Increment orchestrator usage count
 */
function recordOrchestratorRun() {
	state.license = incrementOrchestratorUsage(state.license);
	saveLicenseToStorage(state.license);
}

/**
 * Reset monthly usage (called at start of each month by background task)
 */
function resetUsage() {
	state.license = resetMonthlyUsage(state.license);
	saveLicenseToStorage(state.license);
}

/**
 * Validate license with backend
 */
async function validateLicense(): Promise<boolean> {
	if (!browser) return false;

	// Check if we need to validate (TTL expired)
	const lastValidated = state.license.lastValidatedAt;
	if (lastValidated && Date.now() - lastValidated.getTime() < VALIDATION_CACHE_TTL) {
		return true; // Still valid from cache
	}

	state.isValidating = true;
	state.validationError = null;

	try {
		const response = await fetch(`${API_ENDPOINT}/validate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				userId: state.license.userId,
				email: state.license.email
			})
		});

		if (!response.ok) {
			throw new Error(`Validation failed: ${response.statusText}`);
		}

		const data: LicenseValidationResponse = await response.json();

		if (!data.valid) {
			state.validationError = data.error || 'License validation failed';
			return false;
		}

		// Update license from backend response
		const config = TIER_CONFIGS[data.tier];
		state.license = {
			...state.license,
			tier: data.tier,
			userId: data.userId,
			email: data.email,
			expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
			trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
			features: new Set(data.features),
			limits: data.limits,
			orchestratorUsageThisMonth: data.orchestratorUsageThisMonth,
			lastValidatedAt: new Date()
		};

		saveLicenseToStorage(state.license);
		return true;
	} catch (error) {
		console.error('License validation error:', error);
		state.validationError = error instanceof Error ? error.message : 'Unknown error';
		return false;
	} finally {
		state.isValidating = false;
	}
}

/**
 * Set user info (for linking anonymous license)
 */
function setUserInfo(userId: string, email: string) {
	state.license = {
		...state.license,
		userId,
		email
	};
	saveLicenseToStorage(state.license);
}

/**
 * Reset to free tier (for testing)
 */
function resetToFree() {
	state.license = createFreeLicense(state.license.userId, state.license.email);
	saveLicenseToStorage(state.license);
}

// ============================================================================
// AUTO-VALIDATION ON MOUNT
// ============================================================================

if (browser) {
	// Auto-validate on mount if cache expired
	const lastValidated = state.license.lastValidatedAt;
	if (!lastValidated || Date.now() - lastValidated.getTime() >= VALIDATION_CACHE_TTL) {
		validateLicense().catch(console.error);
	}

	// Check if we need to reset monthly usage (new month)
	const lastReset = state.license.lastValidatedAt;
	const now = new Date();
	if (
		lastReset &&
		(now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear())
	) {
		resetUsage();
	}
}

// ============================================================================
// EXPORTS
// ============================================================================

export const licenseStore = {
	// State (getters)
	get license() {
		return state.license;
	},
	get tier() {
		return state.license.tier;
	},
	get isValidating() {
		return state.isValidating;
	},
	get validationError() {
		return state.validationError;
	},

	// Derived (tier checks)
	get isFree() {
		return isFree;
	},
	get isTrial() {
		return isTrial;
	},
	get isPro() {
		return isPro;
	},
	get isEnterprise() {
		return isEnterprise;
	},

	// Derived (status checks)
	get trialExpired() {
		return trialExpired;
	},
	get licenseExpired() {
		return licenseExpired;
	},
	get trialDaysRemaining() {
		return trialDaysRemaining;
	},

	// Derived (feature checks)
	get canUseOrchestrator() {
		return canUseOrchestratorDerived;
	},
	get canUseCloudExecution() {
		return canUseCloudExecution;
	},
	get canUseModelComparison() {
		return canUseModelComparison;
	},
	get canUseTeamWorkspaces() {
		return canUseTeamWorkspaces;
	},

	// Derived (quota)
	get orchestratorQuotaRemaining() {
		return orchestratorQuotaRemaining;
	},

	// Actions
	checkFeature,
	beginTrial,
	upgradeTier,
	recordOrchestratorRun,
	resetUsage,
	validateLicense,
	setUserInfo,
	resetToFree
};
