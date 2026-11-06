<script lang="ts">
	import { refactoringStore } from '$lib/stores/refactoringStore.svelte';
	import type { RefactoringProject, PhaseExecution } from '$lib/refactoring/types/execution';

	let refactoringState = $derived(refactoringStore.state);
	let plan = $derived(refactoringStore.plan);
	let project = $derived(refactoringStore.project);
	let automation = $derived(refactoringStore.automation);

	let isExecuting = $state(false);
	let currentPhaseIndex = $state(0);
	let currentTaskIndex = $state(0);

	// Get progress information
	let progress = $derived(
		project && automation ? automation.getProgress(project) : null
	);

	async function handleStartExecution() {
		if (!plan || !automation || !refactoringState.analysis) return;

		try {
			isExecuting = true;
			refactoringStore.startExecution();

			// Create and start project
			const newProject = await automation.execute(plan, refactoringState.analysis);
			refactoringStore.updateProject(newProject);

			// Execute phases and tasks
			await executeAllTasks(newProject);

			isExecuting = false;
		} catch (error) {
			isExecuting = false;
			refactoringStore.failExecution(error instanceof Error ? error.message : 'Execution failed');
		}
	}

	async function executeAllTasks(proj: RefactoringProject) {
		let updatedProject = proj;

		for (let phaseIndex = 0; phaseIndex < proj.plan.phases.length; phaseIndex++) {
			currentPhaseIndex = phaseIndex;
			const phase = proj.plan.phases[phaseIndex];

			for (let taskIndex = 0; taskIndex < phase.tasks.length; taskIndex++) {
				currentTaskIndex = taskIndex;
				const task = phase.tasks[taskIndex];

				// Execute task
				updatedProject = await automation!.executeTask(
					updatedProject,
					phase.number,
					task.id
				);
				refactoringStore.updateProject(updatedProject);

				// Small delay for visualization
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			// Complete phase
			updatedProject = await automation!.completePhase(updatedProject, phase.number);
			refactoringStore.updateProject(updatedProject);
		}

		// Move to completion
		refactoringStore.completeExecution();
	}

	function getPhaseStatus(phaseExecution: PhaseExecution): string {
		if (phaseExecution.status === 'completed') return 'completed';
		if (phaseExecution.status === 'running') return 'running';
		if (phaseExecution.status === 'failed') return 'failed';
		return 'pending';
	}

	function getTaskStatusIcon(status: string): string {
		switch (status) {
			case 'completed':
				return '✓';
			case 'running':
				return '⟳';
			case 'failed':
				return '✗';
			default:
				return '○';
		}
	}
</script>

<div class="execute-step">
	<div class="step-header">
		<h2>Step 3: Execute Refactoring</h2>
		<p class="step-description">
			Execute the refactoring plan with real-time progress monitoring and quality gates.
		</p>
	</div>

	{#if !project}
		<div class="start-section">
			<div class="execution-info">
				<h3>Ready to Execute</h3>

				<div class="info-grid">
					<div class="info-card">
						<div class="info-label">Total Phases</div>
						<div class="info-value">{plan?.phases.length || 0}</div>
					</div>

					<div class="info-card">
						<div class="info-label">Total Tasks</div>
						<div class="info-value">
							{plan?.phases.reduce((sum, p) => sum + p.tasks.length, 0) || 0}
						</div>
					</div>

					<div class="info-card">
						<div class="info-label">Estimated Time</div>
						<div class="info-value">{plan?.totalEstimatedHours || 0}h</div>
					</div>

					<div class="info-card">
						<div class="info-label">Quality Gates</div>
						<div class="info-value">{plan?.qualityGates?.length || 0}</div>
					</div>
				</div>

				<div class="warning-box">
					<strong>Note:</strong> Execution will run tasks sequentially. Each task will be simulated
					for testing purposes. Real Claude Code integration coming soon.
				</div>
			</div>

			<div class="actions">
				<button class="btn-secondary" onclick={() => refactoringStore.resetToStep('plan')}>
					Back to Plan
				</button>

				<button class="btn-primary" onclick={handleStartExecution} disabled={isExecuting}>
					{isExecuting ? 'Starting...' : 'Start Execution'}
				</button>
			</div>
		</div>
	{:else}
		<div class="execution-section">
			{#if progress}
				<div class="progress-header">
					<div class="progress-stats">
						<div class="stat">
							<span class="stat-label">Progress</span>
							<span class="stat-value">{Math.round(progress.percentage)}%</span>
						</div>

						<div class="stat">
							<span class="stat-label">Tasks</span>
							<span class="stat-value">{progress.completedTasks}/{progress.totalTasks}</span>
						</div>

						<div class="stat">
							<span class="stat-label">Phases</span>
							<span class="stat-value">{progress.completedPhases}/{progress.totalPhases}</span>
						</div>

						<div class="stat">
							<span class="stat-label">Time Remaining</span>
							<span class="stat-value">{progress.estimatedTimeRemaining}h</span>
						</div>
					</div>

					<div class="progress-bar-container">
						<div class="progress-bar" style="width: {progress.percentage}%"></div>
					</div>
				</div>
			{/if}

			<div class="phases-list">
				<h3>Execution Status</h3>

				{#each project.phases as phaseExecution, index}
					{@const phase = plan?.phases.find((p) => p.number === phaseExecution.phase)}
					{@const status = getPhaseStatus(phaseExecution)}

					<div class="phase-card" class:active={status === 'running'} class:completed={status === 'completed'}>
						<div class="phase-header">
							<div class="phase-title">
								<span class="phase-status {status}">
									{status === 'completed' ? '✓' : status === 'running' ? '⟳' : '○'}
								</span>
								<h4>Phase {phaseExecution.phase}: {phase?.name}</h4>
							</div>

							<div class="phase-meta">
								<span class="badge {status}">{status}</span>
								{#if phaseExecution.startedAt}
									<span class="time-info">
										Started: {new Date(phaseExecution.startedAt).toLocaleTimeString()}
									</span>
								{/if}
							</div>
						</div>

						{#if status !== 'pending'}
							<div class="tasks-list">
								{#each phaseExecution.tasks as taskExecution}
									{@const task = phase?.tasks.find((t) => t.id === taskExecution.taskId)}

									<div class="task-row" class:active={taskExecution.status === 'running'}>
										<span class="task-icon">{getTaskStatusIcon(taskExecution.status)}</span>
										<span class="task-title">{task?.title}</span>
										<span class="task-status {taskExecution.status}">{taskExecution.status}</span>

										{#if taskExecution.startedAt && taskExecution.completedAt}
											{@const duration =
												(new Date(taskExecution.completedAt).getTime() -
													new Date(taskExecution.startedAt).getTime()) /
												1000 /
												60}
											<span class="task-duration">{duration.toFixed(1)}m</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if refactoringState.executeError}
				<div class="error-message">
					<strong>Error:</strong>
					{refactoringState.executeError}
				</div>
			{/if}

			{#if project.status === 'completed'}
				<div class="actions">
					<button class="btn-secondary" onclick={() => refactoringStore.resetToStep('execute')}>
						Re-execute
					</button>

					<button class="btn-primary" onclick={() => refactoringStore.startCompletion()}>
						Continue to Results
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.execute-step {
		max-width: 1000px;
		margin: 0 auto;
	}

	.step-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.step-header h2 {
		font-size: 1.75rem;
		margin-bottom: 0.5rem;
	}

	.step-description {
		color: var(--text-secondary);
	}

	.start-section,
	.execution-section {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 2rem;
		border: 1px solid var(--border-color);
	}

	.execution-info h3 {
		font-size: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.info-card {
		text-align: center;
		padding: 1.5rem;
		background: var(--bg-primary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.info-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.info-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.warning-box {
		padding: 1rem;
		background: #fef3c7;
		border: 1px solid #fbbf24;
		border-radius: 8px;
		color: #92400e;
		margin-bottom: 1.5rem;
	}

	.progress-header {
		margin-bottom: 2rem;
	}

	.progress-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.progress-bar-container {
		height: 8px;
		background: var(--bg-primary);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
		transition: width 0.3s ease;
	}

	.phases-list {
		margin-top: 2rem;
	}

	.phases-list h3 {
		font-size: 1.25rem;
		margin-bottom: 1rem;
	}

	.phase-card {
		background: var(--bg-primary);
		border-radius: 8px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
		margin-bottom: 1rem;
		transition: all 0.3s;
	}

	.phase-card.active {
		border-left: 4px solid #667eea;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
	}

	.phase-card.completed {
		opacity: 0.8;
	}

	.phase-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.phase-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.phase-status {
		font-size: 1.5rem;
	}

	.phase-status.running {
		animation: spin 2s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.phase-header h4 {
		font-size: 1.125rem;
		margin: 0;
	}

	.phase-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.badge.running {
		background: #dbeafe;
		color: #1e40af;
	}

	.badge.completed {
		background: #d1fae5;
		color: #065f46;
	}

	.badge.failed {
		background: #fee2e2;
		color: #991b1b;
	}

	.badge.pending {
		background: #e5e7eb;
		color: #374151;
	}

	.time-info {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.tasks-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.task-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border-radius: 4px;
		transition: all 0.2s;
	}

	.task-row.active {
		background: #dbeafe;
		border-left: 3px solid #667eea;
	}

	.task-icon {
		font-size: 1.25rem;
		min-width: 1.5rem;
		text-align: center;
	}

	.task-title {
		flex: 1;
		color: var(--text-primary);
	}

	.task-status {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.task-status.completed {
		background: #d1fae5;
		color: #065f46;
	}

	.task-status.running {
		background: #dbeafe;
		color: #1e40af;
	}

	.task-status.failed {
		background: #fee2e2;
		color: #991b1b;
	}

	.task-duration {
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 2rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		color: white;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		color: var(--text-primary);
		background: var(--bg-primary);
		border: 1px solid var(--border-color);
	}

	.btn-secondary:hover {
		background: var(--bg-tertiary);
	}

	.error-message {
		margin-top: 1rem;
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		color: #991b1b;
	}
</style>
