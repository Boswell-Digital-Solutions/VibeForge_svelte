/**
 * Refactoring Automation
 *
 * High-level API for automated refactoring combining all system components
 */

import type { CodebaseAnalysis } from './types/analysis';
import type { QualityStandards } from './types/standards';
import type { RefactoringPlan } from './types/planning';
import type { RefactoringProject, RefactoringOutcome } from './types/execution';
import type { TaskRecommendation } from './types/learning';

import { CodebaseAnalyzer } from './analyzer/CodebaseAnalyzer';
import { RefactoringPlanner, type PlannerConfig } from './planner/RefactoringPlanner';
import { TaskExecutor, type ExecutorConfig } from './executor/TaskExecutor';
import { LearningLoop } from './executor/LearningLoop';
import { balancedStandards } from './standards/presets';
import { NEUROFORGE_URL } from '$lib/core/api/endpoints';

export interface AutomationConfig {
	/**
	 * Repository path for git operations
	 */
	repositoryPath: string;

	/**
	 * Whether to enable learning integration with NeuroForge
	 */
	enableLearning?: boolean;

	/**
	 * NeuroForge API base URL
	 */
	neuroforgeUrl?: string;

	/**
	 * Whether to create git checkpoints
	 */
	createCheckpoints?: boolean;

	/**
	 * Whether to auto-verify quality gates
	 */
	autoVerifyGates?: boolean;

	/**
	 * Default quality standards to use
	 */
	defaultStandards?: QualityStandards;
}

/**
 * Refactoring Automation
 *
 * Main entry point for the automated refactoring system
 */
export class RefactoringAutomation {
	private analyzer: CodebaseAnalyzer;
	private planner: RefactoringPlanner;
	private executor: TaskExecutor;
	private learningLoop: LearningLoop;
	private config: Required<AutomationConfig>;

	constructor(config: AutomationConfig) {
		this.config = {
			enableLearning: true,
			createCheckpoints: true,
			autoVerifyGates: true,
			defaultStandards: balancedStandards,
			neuroforgeUrl: `${NEUROFORGE_URL}/api`,
			...config
		};

		// Initialize components
		this.analyzer = new CodebaseAnalyzer();
		this.planner = new RefactoringPlanner();

		const executorConfig: ExecutorConfig = {
			repositoryPath: this.config.repositoryPath,
			createCheckpoints: this.config.createCheckpoints,
			enableLearning: this.config.enableLearning,
			neuroforgeUrl: this.config.neuroforgeUrl,
			autoVerifyGates: this.config.autoVerifyGates
		};
		this.executor = new TaskExecutor(executorConfig);

		this.learningLoop = new LearningLoop({
			baseUrl: this.config.neuroforgeUrl,
			enabled: this.config.enableLearning
		});
	}

	/**
	 * Step 1: Analyze codebase
	 *
	 * Scans the codebase and generates comprehensive analysis
	 */
	async analyze(path: string): Promise<CodebaseAnalysis> {
		return this.analyzer.analyze(path);
	}

	/**
	 * Step 2: Create refactoring plan
	 *
	 * Generates tasks, phases, and prompts from analysis
	 */
	async createPlan(
		analysis: CodebaseAnalysis,
		options?: {
			standards?: QualityStandards;
			complexity?: 'low' | 'medium' | 'high';
			getLearningRecommendations?: boolean;
		}
	): Promise<RefactoringPlan> {
		const standards = options?.standards || this.config.defaultStandards;
		const complexity = options?.complexity || 'medium';

		// Get learning recommendations if enabled
		let recommendations: TaskRecommendation[] = [];
		if (options?.getLearningRecommendations && this.config.enableLearning) {
			recommendations = await this.learningLoop.getTaskRecommendations({
				analysis,
				targetStandard: standards.id
			});
		}

		const plannerConfig: PlannerConfig = {
			standards,
			complexity,
			recommendations // Pass TaskRecommendation[] directly
		};

		return this.planner.createPlan(analysis, plannerConfig);
	}

	/**
	 * Step 3: Execute refactoring plan
	 *
	 * Creates project and starts execution
	 */
	async execute(
		plan: RefactoringPlan,
		initialAnalysis: CodebaseAnalysis
	): Promise<RefactoringProject> {
		// Create project
		const project = await this.executor.createProject(plan, initialAnalysis);

		// Start execution
		return this.executor.startProject(project);
	}

	/**
	 * Execute a single task
	 */
	async executeTask(
		project: RefactoringProject,
		phaseNumber: number,
		taskId: string
	): Promise<RefactoringProject> {
		return this.executor.executeTask(project, phaseNumber, taskId);
	}

	/**
	 * Complete a phase
	 */
	async completePhase(
		project: RefactoringProject,
		phaseNumber: number
	): Promise<RefactoringProject> {
		return this.executor.completePhase(project, phaseNumber);
	}

	/**
	 * Step 4: Complete project and record outcome
	 *
	 * Finalizes project, analyzes outcome, and records to learning system
	 */
	async complete(
		project: RefactoringProject,
		finalAnalysis: CodebaseAnalysis,
		initialAnalysis: CodebaseAnalysis
	): Promise<{ project: RefactoringProject; outcome: RefactoringOutcome }> {
		return this.executor.completeProject(project, finalAnalysis, initialAnalysis);
	}

	/**
	 * Get current progress of a project
	 */
	getProgress(project: RefactoringProject) {
		return this.executor.getProgressTracker().calculateProgress(project);
	}

	/**
	 * Validate a refactoring plan
	 */
	validatePlan(plan: RefactoringPlan): { valid: boolean; errors: string[] } {
		return this.planner.validatePlan(plan);
	}

	/**
	 * Handle task failure
	 */
	async handleFailure(
		project: RefactoringProject,
		phaseNumber: number,
		taskId: string,
		error: Error
	): Promise<RefactoringProject> {
		return this.executor.handleTaskFailure(project, phaseNumber, taskId, error);
	}

	/**
	 * Get learning metrics
	 */
	async getLearningMetrics() {
		return this.learningLoop.getLearningMetrics();
	}

	/**
	 * Check if learning system is available
	 */
	async checkLearningHealth(): Promise<boolean> {
		return this.learningLoop.healthCheck();
	}

	/**
	 * Enable/disable learning
	 */
	setLearningEnabled(enabled: boolean): void {
		this.learningLoop.setEnabled(enabled);
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Required<AutomationConfig> {
		return { ...this.config };
	}

	/**
	 * Get analyzer instance
	 */
	getAnalyzer(): CodebaseAnalyzer {
		return this.analyzer;
	}

	/**
	 * Get planner instance
	 */
	getPlanner(): RefactoringPlanner {
		return this.planner;
	}

	/**
	 * Get executor instance
	 */
	getExecutor(): TaskExecutor {
		return this.executor;
	}

	/**
	 * Get learning loop instance
	 */
	getLearningLoop(): LearningLoop {
		return this.learningLoop;
	}
}
