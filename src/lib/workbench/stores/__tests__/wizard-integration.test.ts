/**
 * Wizard Integration Tests
 *
 * Tests for wizard flow, validation, and state management across steps.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { wizardStore } from '../wizard.svelte';
import type { ArchitecturePattern } from '$lib/workbench/types/architecture';

// Mock browser environment
const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		}
	};
})();

global.localStorage = localStorageMock as Storage;

describe('Wizard Integration Tests', () => {
	const mockPattern: ArchitecturePattern = {
		id: 'test-pattern',
		name: 'test-pattern',
		displayName: 'Test Pattern',
		description: 'Test architecture pattern',
		category: 'web',
		complexity: 'intermediate',
		maturity: 'stable',
		popularity: 80,
		icon: 'globe',
		components: [
			{
				id: 'frontend',
				name: 'Frontend',
				role: 'frontend',
				description: 'Frontend UI',
				language: 'typescript',
				framework: 'sveltekit',
				location: './frontend',
				dependencies: [],
				scaffolding: {
					directories: [{ path: 'src', description: 'Source code' }],
					files: [{ path: 'package.json', content: '{}', templateEngine: 'none', overwritable: false }],
					packageFiles: {},
					configFiles: {}
				},
				commands: {
					install: ['npm install'],
					dev: ['npm run dev'],
					build: ['npm run build'],
					test: ['npm test']
				}
			},
			{
				id: 'backend',
				name: 'Backend',
				role: 'backend',
				description: 'Backend API',
				language: 'typescript',
				framework: 'express',
				location: './backend',
				dependencies: [],
				scaffolding: {
					directories: [{ path: 'src', description: 'Source code' }],
					files: [{ path: 'package.json', content: '{}', templateEngine: 'none', overwritable: false }],
					packageFiles: {},
					configFiles: {}
				},
				commands: {
					install: ['npm install'],
					dev: ['npm run dev'],
					build: ['npm run build'],
					test: ['npm test']
				}
			}
		],
		idealFor: ['Web applications'],
		notIdealFor: ['CLI tools'],
		tags: ['Node.js', 'npm', 'TypeScript'],
		prerequisites: {
			tools: ['Node.js', 'npm'],
			skills: ['TypeScript'],
			timeEstimate: '1 hour'
		},
		integration: {
			protocol: 'rest-api',
			sharedTypes: true,
			sharedConfig: false
		}
	};

	beforeEach(() => {
		localStorageMock.clear();
		wizardStore.close();
		wizardStore.config.projectName = '';
		wizardStore.config.projectType = null;
		wizardStore.config.architecturePattern = null;
		wizardStore.config.primaryLanguage = null;
		wizardStore.config.stack = null;
		wizardStore.config.componentConfigs.clear();
		wizardStore.currentStep = 1;
	});

	describe('wizard flow - pattern mode', () => {
		it('should complete full wizard flow with pattern selection', () => {
			// Step 1: Project Intent
			wizardStore.open();
			expect(wizardStore.currentStep).toBe(1);
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.projectName = 'My Web App';
			wizardStore.config.projectType = 'web';
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.nextStep();

			// Step 2: Pattern Selection
			expect(wizardStore.currentStep).toBe(2);
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.architecturePattern = mockPattern;
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.nextStep();

			// Step 3: Component Configuration
			expect(wizardStore.currentStep).toBe(3);
			expect(wizardStore.isCurrentStepValid).toBe(true); // Component configs are optional

			wizardStore.nextStep();

			// Step 4: Configuration
			expect(wizardStore.currentStep).toBe(4);
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.nextStep();

			// Step 5: Review
			expect(wizardStore.currentStep).toBe(5);
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});

		it('should indicate when progression is not allowed', () => {
			wizardStore.open();

			// canGoNext should be false without valid project name
			expect(wizardStore.canGoNext).toBe(false);

			// Fill in valid data
			wizardStore.config.projectName = 'Valid Name';
			wizardStore.config.projectType = 'web';
			expect(wizardStore.canGoNext).toBe(true);

			wizardStore.nextStep();
			expect(wizardStore.currentStep).toBe(2);
		});

		it('should allow going back to previous steps', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.nextStep();

			expect(wizardStore.currentStep).toBe(2);
			expect(wizardStore.canGoBack).toBe(true);

			wizardStore.previousStep();
			expect(wizardStore.currentStep).toBe(1);
		});

		it('should not allow going back from step 1', () => {
			wizardStore.open();
			expect(wizardStore.canGoBack).toBe(false);

			wizardStore.previousStep();
			expect(wizardStore.currentStep).toBe(1);
		});

		it('should allow direct navigation to completed steps', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.config.architecturePattern = mockPattern;

			wizardStore.goToStep(3);
			expect(wizardStore.currentStep).toBe(3);

			wizardStore.goToStep(1);
			expect(wizardStore.currentStep).toBe(1);
		});
	});

	describe('wizard flow - legacy mode', () => {
		it('should complete full wizard flow with legacy mode', () => {
			// Step 1: Project Intent
			wizardStore.open();
			wizardStore.config.projectName = 'My CLI Tool';
			wizardStore.config.projectType = 'cli';
			wizardStore.nextStep();

			// Step 2: Pattern Selection (choose legacy mode)
			expect(wizardStore.currentStep).toBe(2);
			wizardStore.config.primaryLanguage = 'python';
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.nextStep();

			// Step 3: Stack (legacy mode shows stack selection)
			expect(wizardStore.currentStep).toBe(3);
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.stack = 'python-fastapi';
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.nextStep();

			// Step 4: Configuration
			expect(wizardStore.currentStep).toBe(4);
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.nextStep();

			// Step 5: Review
			expect(wizardStore.currentStep).toBe(5);
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});

		it('should require language selection in legacy mode', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.nextStep();

			// Step 2: Neither pattern nor language selected
			expect(wizardStore.isCurrentStepValid).toBe(false);

			// Select language for legacy mode
			wizardStore.config.primaryLanguage = 'javascript-typescript';
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});

		it('should require stack selection in legacy mode', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.config.primaryLanguage = 'javascript-typescript';
			wizardStore.nextStep();
			wizardStore.nextStep();

			// Step 3: Stack not selected
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.stack = 'react-vite';
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});
	});

	describe('dual-mode validation', () => {
		it('should validate pattern mode correctly', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.nextStep();

			// Select pattern mode
			wizardStore.config.architecturePattern = mockPattern;
			expect(wizardStore.isCurrentStepValid).toBe(true);

			// Legacy fields should not be required
			expect(wizardStore.config.primaryLanguage).toBeNull();
			expect(wizardStore.config.stack).toBeNull();
		});

		it('should validate legacy mode correctly', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.nextStep();

			// Select legacy mode
			wizardStore.config.primaryLanguage = 'python';
			expect(wizardStore.isCurrentStepValid).toBe(true);

			// Pattern should not be required
			expect(wizardStore.config.architecturePattern).toBeNull();
		});

		it('should allow switching between modes', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.nextStep();

			// Start with pattern mode
			wizardStore.config.architecturePattern = mockPattern;
			expect(wizardStore.isCurrentStepValid).toBe(true);

			// Switch to legacy mode
			wizardStore.config.architecturePattern = null;
			wizardStore.config.primaryLanguage = 'rust';
			expect(wizardStore.isCurrentStepValid).toBe(true);

			// Switch back to pattern mode
			wizardStore.config.primaryLanguage = null;
			wizardStore.config.architecturePattern = mockPattern;
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});
	});

	describe('project name validation', () => {
		it('should require minimum 3 characters', () => {
			wizardStore.open();
			wizardStore.config.projectType = 'web';

			wizardStore.config.projectName = 'ab';
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.projectName = 'abc';
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});

		it('should allow maximum 50 characters', () => {
			wizardStore.open();
			wizardStore.config.projectType = 'web';

			wizardStore.config.projectName = 'a'.repeat(50);
			expect(wizardStore.isCurrentStepValid).toBe(true);

			wizardStore.config.projectName = 'a'.repeat(51);
			expect(wizardStore.isCurrentStepValid).toBe(false);
		});

		it('should trim whitespace for validation', () => {
			wizardStore.open();
			wizardStore.config.projectType = 'web';

			wizardStore.config.projectName = '   ab   ';
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.projectName = '   abc   ';
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});

		it('should require project type', () => {
			wizardStore.open();

			wizardStore.config.projectName = 'Valid Name';
			wizardStore.config.projectType = null;
			expect(wizardStore.isCurrentStepValid).toBe(false);

			wizardStore.config.projectType = 'web';
			expect(wizardStore.isCurrentStepValid).toBe(true);
		});
	});

	describe('draft persistence', () => {
		it('should save draft on step navigation', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test Project';
			wizardStore.config.projectType = 'web';
			wizardStore.config.architecturePattern = mockPattern;

			wizardStore.nextStep();

			// Draft should be saved to localStorage
			const stored = localStorageMock.getItem('vibeforge:wizard-draft');
			expect(stored).toBeTruthy();

			if (stored) {
				const parsed = JSON.parse(stored);
				expect(parsed.projectName).toBe('Test Project');
				expect(parsed.projectType).toBe('web');
				expect(parsed.architecturePattern).toBeTruthy();
			}
		});

		it('should load draft when opening wizard', () => {
			// Save a draft
			const draft = {
				projectName: 'Saved Project',
				projectType: 'fullstack',
				architecturePattern: mockPattern,
				componentConfigs: {},
				primaryLanguage: null,
				additionalLanguages: [],
				stack: null,
				features: []
			};

			localStorageMock.setItem('vibeforge:wizard-draft', JSON.stringify(draft));

			// Open wizard
			wizardStore.open();

			// Should load the draft
			expect(wizardStore.config.projectName).toBe('Saved Project');
			expect(wizardStore.config.projectType).toBe('fullstack');
		});

		it('should serialize Map to object for localStorage', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.config.architecturePattern = mockPattern;

			// Add component configs
			wizardStore.config.componentConfigs.set('frontend', {
				componentId: 'frontend',
				location: './frontend',
				includeTests: true,
				includeDocker: false,
				includeCi: false
			});

			wizardStore.nextStep();

			const stored = localStorageMock.getItem('vibeforge:wizard-draft');
			expect(stored).toBeTruthy();

			if (stored) {
				const parsed = JSON.parse(stored);
				// Should be an object, not a Map
				expect(typeof parsed.componentConfigs).toBe('object');
				expect(parsed.componentConfigs.frontend).toBeTruthy();
			}
		});

		it('should deserialize object to Map when loading draft', () => {
			// Save draft with componentConfigs as object
			const draft = {
				projectName: 'Test',
				projectType: 'web',
				architecturePattern: mockPattern,
				componentConfigs: {
					frontend: {
						componentId: 'frontend',
						location: './frontend',
						includeTests: true,
						includeDocker: false,
						includeCi: false
					}
				},
				primaryLanguage: null,
				additionalLanguages: [],
				stack: null,
				features: []
			};

			localStorageMock.setItem('vibeforge:wizard-draft', JSON.stringify(draft));

			wizardStore.open();

			// Should convert object to Map
			expect(wizardStore.config.componentConfigs instanceof Map).toBe(true);
			expect(wizardStore.config.componentConfigs.get('frontend')).toBeTruthy();
		});

		it('should clear draft when project is created', async () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.config.architecturePattern = mockPattern;
			wizardStore.nextStep();

			// Draft should exist
			expect(localStorageMock.getItem('vibeforge:wizard-draft')).toBeTruthy();

			// Create project
			await wizardStore.createProject();

			// Draft should be cleared
			expect(localStorageMock.getItem('vibeforge:wizard-draft')).toBeNull();
		});

		it('should clear draft when discarding', () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.nextStep();

			expect(localStorageMock.getItem('vibeforge:wizard-draft')).toBeTruthy();

			wizardStore.discardAndClose();

			expect(localStorageMock.getItem('vibeforge:wizard-draft')).toBeNull();
		});
	});

	describe('wizard state management', () => {
		it('should track total steps correctly', () => {
			expect(wizardStore.totalSteps).toBe(5);
		});

		it('should open and close wizard', () => {
			expect(wizardStore.isOpen).toBe(false);

			wizardStore.open();
			expect(wizardStore.isOpen).toBe(true);

			wizardStore.close();
			expect(wizardStore.isOpen).toBe(false);
		});

		it('should reset to step 1 when opening', () => {
			wizardStore.currentStep = 3;
			wizardStore.open();

			expect(wizardStore.currentStep).toBe(1);
		});

		it('should reset config when creating project', async () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.config.architecturePattern = mockPattern;

			await wizardStore.createProject();

			expect(wizardStore.config.projectName).toBe('');
			expect(wizardStore.config.projectType).toBeNull();
			expect(wizardStore.config.architecturePattern).toBeNull();
		});

		it('should close wizard after creating project', async () => {
			wizardStore.open();
			wizardStore.config.projectName = 'Test';
			wizardStore.config.projectType = 'web';
			wizardStore.config.primaryLanguage = 'typescript';
			wizardStore.config.stack = 'sveltekit';

			await wizardStore.createProject();

			expect(wizardStore.isOpen).toBe(false);
		});
	});

	describe('edge cases', () => {
		it('should handle invalid step numbers in goToStep', () => {
			wizardStore.open();

			wizardStore.goToStep(0);
			expect(wizardStore.currentStep).toBe(1); // Should not change

			wizardStore.goToStep(10);
			expect(wizardStore.currentStep).toBe(1); // Should not change

			wizardStore.goToStep(-1);
			expect(wizardStore.currentStep).toBe(1); // Should not change
		});

		it('should handle nextStep at final step', () => {
			wizardStore.open();
			wizardStore.currentStep = 5;

			wizardStore.nextStep();
			expect(wizardStore.currentStep).toBe(5); // Should not advance
		});

		it('should handle previousStep at first step', () => {
			wizardStore.open();
			wizardStore.currentStep = 1;

			wizardStore.previousStep();
			expect(wizardStore.currentStep).toBe(1); // Should not go back
		});

		it('should handle missing draft gracefully', () => {
			localStorageMock.clear();

			wizardStore.open();

			// Should use default config
			expect(wizardStore.config.projectName).toBe('');
			expect(wizardStore.config.projectType).toBeNull();
		});

		it('should handle corrupted draft data', () => {
			localStorageMock.setItem('vibeforge:wizard-draft', 'invalid json{');

			wizardStore.open();

			// Should fallback to default config
			expect(wizardStore.config.projectName).toBe('');
		});

		it('should handle draft with missing componentConfigs', () => {
			const draft = {
				projectName: 'Test',
				projectType: 'web',
				architecturePattern: null,
				primaryLanguage: null,
				additionalLanguages: [],
				stack: null,
				features: []
				// componentConfigs missing
			};

			localStorageMock.setItem('vibeforge:wizard-draft', JSON.stringify(draft));

			wizardStore.open();

			// Should initialize with empty Map
			expect(wizardStore.config.componentConfigs instanceof Map).toBe(true);
			expect(wizardStore.config.componentConfigs.size).toBe(0);
		});
	});
});
