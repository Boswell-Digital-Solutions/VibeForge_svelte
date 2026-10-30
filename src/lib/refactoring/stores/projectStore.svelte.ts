/**
 * Project Store (Svelte 5)
 *
 * Manages the current refactoring project state using Svelte 5 runes.
 */

import type { RefactoringProject, ExecutionStatus } from '../types/execution';
import type { RefactoringPlan } from '../types/planning';
import type { CodebaseAnalysis } from '../types/analysis';

import { RefactoringExecutor } from '../executor/RefactoringExecutor';
import { NEUROFORGE_URL } from '$lib/core/api/endpoints';

interface ProjectStoreState {
	/**
	 * Current active project
	 */
	project: RefactoringProject | null;

	/**
	 * Executor instance
	 */
	executor: RefactoringExecutor | null;

	/**
	 * Loading state
	 */
	isLoading: boolean;

	/**
	 * Error state
	 */
	error: string | null;
}

/**
 * Creates a project store
 */
function createProjectStore() {
	let state = $state<ProjectStoreState>({
		project: null,
		executor: null,
		isLoading: false,
		error: null
	});

	// Derived values
	const isActive = $derived(state.project !== null);
	const isRunning = $derived(state.project?.status === 'running');
	const isCompleted = $derived(state.project?.status === 'completed');
	const isFailed = $derived(state.project?.status === 'failed');

	const currentPhase = $derived(state.project?.progress.currentPhase || 0);
	const totalPhases = $derived(state.project?.progress.totalPhases || 0);
	const percentComplete = $derived(state.project?.progress.percentage || 0);

	return {
		// State
		get project() {
			return state.project;
		},
		get executor() {
			return state.executor;
		},
		get isLoading() {
			return state.isLoading;
		},
		get error() {
			return state.error;
		},

		// Derived
		get isActive() {
			return isActive;
		},
		get isRunning() {
			return isRunning;
		},
		get isCompleted() {
			return isCompleted;
		},
		get isFailed() {
			return isFailed;
		},
		get currentPhase() {
			return currentPhase;
		},
		get totalPhases() {
			return totalPhases;
		},
		get percentComplete() {
			return percentComplete;
		},

		// Actions

		/**
		 * Initializes a new project from a plan
		 */
		async createProject(
			plan: RefactoringPlan,
			analysis: CodebaseAnalysis,
			repositoryPath: string
		): Promise<void> {
			state.isLoading = true;
			state.error = null;

			try {
				// Create executor
				const executor = new RefactoringExecutor({
					repositoryPath,
					git: { enabled: false }, // Simulation mode for now
					verifier: { enabled: false },
					claudeCode: { enabled: false },
					learning: { enabled: true, neuroforgeUrl: `${NEUROFORGE_URL}/api` }
				});

				// Create project
				const project = await executor.createProject(plan, analysis);

				state.executor = executor;
				state.project = project;
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
				throw error;
			} finally {
				state.isLoading = false;
			}
		},

		/**
		 * Starts project execution
		 */
		async startProject(): Promise<void> {
			if (!state.project || !state.executor) {
				throw new Error('No active project');
			}

			state.isLoading = true;
			state.error = null;

			try {
				const updatedProject = await state.executor.startProject(state.project);
				state.project = updatedProject;
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
				throw error;
			} finally {
				state.isLoading = false;
			}
		},

		/**
		 * Executes a specific phase
		 */
		async executePhase(phaseNumber: number): Promise<void> {
			if (!state.project || !state.executor) {
				throw new Error('No active project');
			}

			state.isLoading = true;
			state.error = null;

			try {
				const updatedProject = await state.executor.executePhase(state.project, phaseNumber);
				state.project = updatedProject;
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
				throw error;
			} finally {
				state.isLoading = false;
			}
		},

		/**
		 * Executes a specific task
		 */
		async executeTask(phaseNumber: number, taskId: string): Promise<void> {
			if (!state.project || !state.executor) {
				throw new Error('No active project');
			}

			state.isLoading = true;
			state.error = null;

			try {
				const updatedProject = await state.executor.executeTask(state.project, phaseNumber, taskId);
				state.project = updatedProject;
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
				throw error;
			} finally {
				state.isLoading = false;
			}
		},

		/**
		 * Rolls back to a checkpoint
		 */
		async rollbackToCheckpoint(checkpointId: string): Promise<void> {
			if (!state.project || !state.executor) {
				throw new Error('No active project');
			}

			state.isLoading = true;
			state.error = null;

			try {
				const updatedProject = await state.executor.rollbackToCheckpoint(state.project, checkpointId);
				state.project = updatedProject;
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
				throw error;
			} finally {
				state.isLoading = false;
			}
		},

		/**
		 * Completes the project
		 */
		async completeProject(): Promise<void> {
			if (!state.project || !state.executor) {
				throw new Error('No active project');
			}

			state.isLoading = true;
			state.error = null;

			try {
				const updatedProject = await state.executor.completeProject(state.project);
				state.project = updatedProject;
			} catch (error) {
				state.error = error instanceof Error ? error.message : String(error);
				throw error;
			} finally {
				state.isLoading = false;
			}
		},

		/**
		 * Clears the current project
		 */
		clearProject(): void {
			state.project = null;
			state.executor = null;
			state.error = null;
		},

		/**
		 * Updates project status (for external updates)
		 */
		updateProject(project: RefactoringProject): void {
			state.project = project;
		}
	};
}

// Create singleton instance
export const projectStore = createProjectStore();
