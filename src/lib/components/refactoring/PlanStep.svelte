<script lang="ts">
	import { refactoringStore } from '$lib/stores/refactoringStore.svelte';
	import { balancedStandards, strictStandards, startupStandards, legacyStandards } from '$lib/refactoring/standards/presets';

	let refactoringState = $derived(refactoringStore.state);
	let isPlanning = $derived(refactoringStore.isPlanning);
	let plan = $derived(refactoringStore.plan);
	let analysis = $derived(refactoringStore.analysis);
	let automation = $derived(refactoringStore.automation);

	const presets = [balancedStandards, strictStandards, startupStandards, legacyStandards];

	let selectedStandardsId = $state('preset-balanced');
	let complexity: 'low' | 'medium' | 'high' = $state('medium');
	let getLearningRecommendations = $state(true);

	async function handleCreatePlan() {
		if (!analysis || !automation) return;

		try {
			refactoringStore.startPlanning();

			const selectedStandards = presets.find((p) => p.id === selectedStandardsId) || balancedStandards;

			const result = await automation.createPlan(analysis, {
				standards: selectedStandards,
				complexity,
				getLearningRecommendations: getLearningRecommendations && refactoringState.enableLearning
			});

			refactoringStore.completePlanning(result);
		} catch (error) {
			refactoringStore.failPlanning(error instanceof Error ? error.message : 'Planning failed');
		}
	}

	function handleContinueToExecute() {
		refactoringStore.startExecution();
	}

	function getTotalTasks(plan: NonNullable<typeof refactoringState.plan>) {
		return plan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
	}
</script>

<div class="plan-step">
	<div class="step-header">
		<h2>Step 2: Create Refactoring Plan</h2>
		<p class="step-description">
			Generate a structured refactoring plan with tasks, phases, and time estimates.
		</p>
	</div>

	{#if !plan}
		<div class="config-section">
			<h3>Planning Configuration</h3>

			<div class="form-group">
				<label for="standards">Quality Standards</label>
				<select id="standards" bind:value={selectedStandardsId} disabled={isPlanning}>
					{#each presets as preset}
						<option value={preset.id}>
							{preset.name} - {preset.testing.minimumCoverage}% coverage
							{#if preset.isDefault}(Default){/if}
						</option>
					{/each}
				</select>
				<p class="help-text">Choose the quality level you want to achieve</p>
			</div>

			<div class="form-group">
				<label for="complexity">Project Complexity</label>
				<select id="complexity" bind:value={complexity} disabled={isPlanning}>
					<option value="low">Low (10% time buffer)</option>
					<option value="medium">Medium (25% time buffer)</option>
					<option value="high">High (50% time buffer)</option>
				</select>
				<p class="help-text">Higher complexity adds more time buffer to estimates</p>
			</div>

			{#if refactoringState.enableLearning}
				<label class="checkbox">
					<input type="checkbox" bind:checked={getLearningRecommendations} disabled={isPlanning} />
					<span>Get AI-powered recommendations from historical data</span>
				</label>
			{/if}

			<div class="actions">
				<button class="btn-secondary" onclick={() => refactoringStore.resetToStep('analyze')} disabled={isPlanning}>
					Back to Analysis
				</button>

				<button class="btn-primary" onclick={handleCreatePlan} disabled={isPlanning}>
					{isPlanning ? 'Generating Plan...' : 'Create Plan'}
				</button>
			</div>

			{#if refactoringState.planError}
				<div class="error-message">
					<strong>Error:</strong>
					{refactoringState.planError}
				</div>
			{/if}
		</div>
	{:else}
		<div class="plan-results">
			<div class="plan-summary">
				<h3>Plan Summary</h3>

				<div class="summary-grid">
					<div class="summary-card">
						<div class="stat-value">{plan.phases.length}</div>
						<div class="stat-label">Phases</div>
					</div>

					<div class="summary-card">
						<div class="stat-value">{getTotalTasks(plan)}</div>
						<div class="stat-label">Tasks</div>
					</div>

					<div class="summary-card">
						<div class="stat-value">{plan.totalEstimatedHours}h</div>
						<div class="stat-label">Estimated Time</div>
					</div>

					<div class="summary-card">
						<div class="stat-value">{plan.prompts.length}</div>
						<div class="stat-label">Prompts Generated</div>
					</div>
				</div>
			</div>

			<div class="phases-section">
				<h3>Phases</h3>

				{#each plan.phases as phase}
					<div class="phase-card" class:required={phase.required}>
						<div class="phase-header">
							<div>
								<h4>Phase {phase.number}: {phase.name}</h4>
								<p>{phase.description}</p>
							</div>
							<div class="phase-meta">
								{#if phase.required}
									<span class="badge required">Required</span>
								{:else}
									<span class="badge optional">Optional</span>
								{/if}
								<span class="time">{phase.estimatedHours}h</span>
							</div>
						</div>

						<div class="tasks-list">
							<strong>{phase.tasks.length} Tasks:</strong>
							{#each phase.tasks as task}
								<div class="task-item">
									<span class="task-priority {task.priority}">{task.priority}</span>
									<span class="task-title">{task.title}</span>
									<span class="task-time">{task.estimatedHours}h</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="actions">
				<button class="btn-secondary" onclick={() => refactoringStore.resetToStep('plan')}>
					Create New Plan
				</button>

				<button class="btn-primary" onclick={handleContinueToExecute}>
					Continue to Execution
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.plan-step {
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

	.config-section,
	.plan-results {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 2rem;
		border: 1px solid var(--border-color);
	}

	.config-section h3,
	.plan-results h3 {
		font-size: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 1rem;
	}

	select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.help-text {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.checkbox {
		display: flex;
		align-items: center;
		margin-bottom: 1rem;
		cursor: pointer;
	}

	.checkbox input {
		margin-right: 0.75rem;
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

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-tertiary);
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		margin-top: 1rem;
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		color: #991b1b;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.summary-card {
		text-align: center;
		padding: 1.5rem;
		background: var(--bg-primary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.phases-section {
		margin-top: 2rem;
	}

	.phase-card {
		background: var(--bg-primary);
		border-radius: 8px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
		margin-bottom: 1rem;
	}

	.phase-card.required {
		border-left: 4px solid #667eea;
	}

	.phase-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
	}

	.phase-header h4 {
		font-size: 1.125rem;
		margin-bottom: 0.25rem;
	}

	.phase-header p {
		color: var(--text-secondary);
		font-size: 0.875rem;
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

	.badge.required {
		background: #dbeafe;
		color: #1e40af;
	}

	.badge.optional {
		background: #e5e7eb;
		color: #374151;
	}

	.time {
		font-weight: 600;
		color: var(--text-secondary);
	}

	.tasks-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tasks-list strong {
		margin-bottom: 0.5rem;
		display: block;
	}

	.task-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: var(--bg-secondary);
		border-radius: 4px;
	}

	.task-priority {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		min-width: 70px;
		text-align: center;
	}

	.task-priority.critical {
		background: #fecaca;
		color: #991b1b;
	}

	.task-priority.high {
		background: #fed7aa;
		color: #9a3412;
	}

	.task-priority.medium {
		background: #fef3c7;
		color: #92400e;
	}

	.task-priority.low {
		background: #e5e7eb;
		color: #374151;
	}

	.task-title {
		flex: 1;
		color: var(--text-primary);
	}

	.task-time {
		font-weight: 600;
		color: var(--text-secondary);
	}
</style>
