<script lang="ts">
	import { refactoringStore } from '$lib/stores/refactoringStore.svelte';
	import { RefactoringAutomation } from '$lib/refactoring';

	let refactoringState = $derived(refactoringStore.state);
	let project = $derived(refactoringStore.project);
	let automation = $derived(refactoringStore.automation);
	let outcome = $derived(refactoringStore.outcome);

	let isAnalyzing = $state(false);
	let finalAnalysisPath = $state('');

	async function handleCompleteProject() {
		if (!project || !automation || !refactoringState.analysis) return;

		try {
			isAnalyzing = true;

			// Analyze final state
			const finalAnalysis = await automation.analyze(finalAnalysisPath || refactoringState.repositoryPath);

			// Complete project and get outcome
			const { project: completedProject, outcome: refactoringOutcome } = await automation.complete(
				project,
				finalAnalysis,
				refactoringState.analysis
			);

			refactoringStore.updateProject(completedProject);
			refactoringStore.setOutcome(refactoringOutcome);

			isAnalyzing = false;
		} catch (error) {
			isAnalyzing = false;
			console.error('Completion failed:', error);
		}
	}

	function getRatingColor(rating: string): string {
		switch (rating) {
			case 'excellent':
				return '#10b981';
			case 'good':
				return '#3b82f6';
			case 'fair':
				return '#f59e0b';
			case 'poor':
				return '#ef4444';
			case 'failed':
				return '#991b1b';
			default:
				return '#6b7280';
		}
	}

	function getRatingIcon(rating: string): string {
		switch (rating) {
			case 'excellent':
				return '🌟';
			case 'good':
				return '✅';
			case 'fair':
				return '👍';
			case 'poor':
				return '⚠️';
			case 'failed':
				return '❌';
			default:
				return '○';
		}
	}

	function formatPercentage(value: number): string {
		return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
	}
</script>

<div class="complete-step">
	<div class="step-header">
		<h2>Step 4: Completion & Results</h2>
		<p class="step-description">
			Analyze final results, evaluate quality improvements, and record outcomes for learning.
		</p>
	</div>

	{#if !outcome}
		<div class="finalize-section">
			<div class="info-box">
				<h3>Ready to Finalize</h3>
				<p>
					Complete the refactoring project by analyzing the final codebase state and evaluating
					improvements.
				</p>
			</div>

			<div class="form-group">
				<label for="final-path">Final Analysis Path (optional)</label>
				<input
					id="final-path"
					type="text"
					bind:value={finalAnalysisPath}
					placeholder={refactoringState.repositoryPath}
					disabled={isAnalyzing}
				/>
				<p class="help-text">Leave empty to use the original repository path</p>
			</div>

			<div class="actions">
				<button class="btn-secondary" onclick={() => refactoringStore.resetToStep('execute')}>
					Back to Execution
				</button>

				<button class="btn-primary" onclick={handleCompleteProject} disabled={isAnalyzing}>
					{isAnalyzing ? 'Analyzing...' : 'Complete & Analyze Results'}
				</button>
			</div>
		</div>
	{:else}
		<div class="results-section">
			<!-- Outcome Rating -->
			<div class="outcome-header">
				<div class="rating-card" style="--rating-color: {getRatingColor(outcome.rating)}">
					<div class="rating-icon">{getRatingIcon(outcome.rating)}</div>
					<div class="rating-text">
						<div class="rating-label">Outcome Rating</div>
						<div class="rating-value">{outcome.rating.toUpperCase()}</div>
					</div>
				</div>

				<div class="success-indicator" class:success={outcome.success} class:failed={!outcome.success}>
					{outcome.success ? '✓ Success' : '✗ Failed'}
				</div>
			</div>

			<!-- Quality Improvements -->
			<div class="improvements-section">
				<h3>Quality Improvements</h3>

				<div class="metrics-grid">
					<div class="metric-card">
						<div class="metric-header">
							<span class="metric-label">Test Coverage</span>
							<span class="metric-change" class:positive={outcome.coverageAfter > outcome.coverageBefore}>
								{formatPercentage(outcome.coverageAfter - outcome.coverageBefore)}
							</span>
						</div>
						<div class="metric-comparison">
							<div class="before">
								<span class="label">Before</span>
								<span class="value">{outcome.coverageBefore.toFixed(1)}%</span>
							</div>
							<div class="arrow">→</div>
							<div class="after">
								<span class="label">After</span>
								<span class="value">{outcome.coverageAfter.toFixed(1)}%</span>
							</div>
						</div>
					</div>

					<div class="metric-card">
						<div class="metric-header">
							<span class="metric-label">Type Errors</span>
							<span class="metric-change" class:positive={outcome.typeErrorsAfter < outcome.typeErrorsBefore}>
								{outcome.typeErrorsBefore - outcome.typeErrorsAfter} fixed
							</span>
						</div>
						<div class="metric-comparison">
							<div class="before">
								<span class="label">Before</span>
								<span class="value">{outcome.typeErrorsBefore}</span>
							</div>
							<div class="arrow">→</div>
							<div class="after">
								<span class="label">After</span>
								<span class="value">{outcome.typeErrorsAfter}</span>
							</div>
						</div>
					</div>

					<div class="metric-card">
						<div class="metric-header">
							<span class="metric-label">Quality Score</span>
							<span class="metric-change" class:positive={outcome.qualityScoreAfter > outcome.qualityScoreBefore}>
								{formatPercentage(outcome.qualityScoreAfter - outcome.qualityScoreBefore)}
							</span>
						</div>
						<div class="metric-comparison">
							<div class="before">
								<span class="label">Before</span>
								<span class="value">{outcome.qualityScoreBefore}/100</span>
							</div>
							<div class="arrow">→</div>
							<div class="after">
								<span class="label">After</span>
								<span class="value">{outcome.qualityScoreAfter}/100</span>
							</div>
						</div>
					</div>

					<div class="metric-card">
						<div class="metric-header">
							<span class="metric-label">TODO Comments</span>
							<span class="metric-change" class:positive={outcome.todosAfter < outcome.todosBefore}>
								{outcome.todosBefore - outcome.todosAfter} resolved
							</span>
						</div>
						<div class="metric-comparison">
							<div class="before">
								<span class="label">Before</span>
								<span class="value">{outcome.todosBefore}</span>
							</div>
							<div class="arrow">→</div>
							<div class="after">
								<span class="label">After</span>
								<span class="value">{outcome.todosAfter}</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Execution Summary -->
			<div class="execution-summary">
				<h3>Execution Summary</h3>

				<div class="summary-grid">
					<div class="summary-item">
						<span class="summary-label">Total Tasks</span>
						<span class="summary-value">{outcome.totalTasks}</span>
					</div>

					<div class="summary-item">
						<span class="summary-label">Completed Tasks</span>
						<span class="summary-value">{outcome.completedTasks}</span>
					</div>

					<div class="summary-item">
						<span class="summary-label">Failed Tasks</span>
						<span class="summary-value">{outcome.failedTasks}</span>
					</div>

					<div class="summary-item">
						<span class="summary-label">Quality Gates Passed</span>
						<span class="summary-value">{outcome.gatesPassed}/{outcome.totalGates}</span>
					</div>
				</div>
			</div>

			<!-- Time Estimation -->
			<div class="estimation-section">
				<h3>Time Estimation</h3>

				<div class="estimation-grid">
					<div class="estimation-item">
						<span class="estimation-label">Estimated</span>
						<span class="estimation-value">{outcome.estimatedHours.toFixed(1)}h</span>
					</div>

					<div class="estimation-item">
						<span class="estimation-label">Actual</span>
						<span class="estimation-value">{outcome.actualHours.toFixed(1)}h</span>
					</div>

					<div class="estimation-item">
						<span class="estimation-label">Variance</span>
						<span class="estimation-value" class:positive={Math.abs(outcome.variance) < 20}>
							{formatPercentage(outcome.variance)}
						</span>
					</div>

					<div class="estimation-item">
						<span class="estimation-label">Accuracy</span>
						<span class="estimation-value" class:positive={Math.abs(outcome.variance) < 20}>
							{(100 - Math.abs(outcome.variance)).toFixed(1)}%
						</span>
					</div>
				</div>

				{#if outcome.estimationFeedback}
					<div class="feedback-box">
						<strong>Estimation Feedback:</strong>
						<ul>
							{#each outcome.estimationFeedback.flatMap((f) => f.factors) as factor}
								<li class:negative={factor.impact === 'negative'} class:positive={factor.impact === 'positive'}>
									{factor.factor}
									<span class="magnitude">({(factor.magnitude * 100).toFixed(0)}% impact)</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="actions">
				<button class="btn-secondary" onclick={() => refactoringStore.reset()}>
					Start New Refactoring
				</button>

				<button
					class="btn-primary"
					onclick={() => {
						/* Export report functionality */
					}}
				>
					Download Report
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.complete-step {
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

	.finalize-section,
	.results-section {
		background: var(--bg-secondary);
		border-radius: 12px;
		padding: 2rem;
		border: 1px solid var(--border-color);
	}

	.info-box {
		margin-bottom: 2rem;
	}

	.info-box h3 {
		font-size: 1.25rem;
		margin-bottom: 0.5rem;
	}

	.info-box p {
		color: var(--text-secondary);
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-size: 1rem;
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.help-text {
		font-size: 0.875rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}

	.outcome-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		padding: 2rem;
		background: var(--bg-primary);
		border-radius: 12px;
		border: 2px solid var(--rating-color);
	}

	.rating-card {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.rating-icon {
		font-size: 4rem;
	}

	.rating-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.rating-value {
		font-size: 2rem;
		font-weight: 700;
		color: var(--rating-color);
	}

	.success-indicator {
		padding: 0.75rem 1.5rem;
		border-radius: 8px;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.success-indicator.success {
		background: #d1fae5;
		color: #065f46;
	}

	.success-indicator.failed {
		background: #fee2e2;
		color: #991b1b;
	}

	.improvements-section,
	.execution-summary,
	.estimation-section {
		margin-top: 2rem;
	}

	.improvements-section h3,
	.execution-summary h3,
	.estimation-section h3 {
		font-size: 1.25rem;
		margin-bottom: 1rem;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1rem;
	}

	.metric-card {
		background: var(--bg-primary);
		border-radius: 8px;
		padding: 1.5rem;
		border: 1px solid var(--border-color);
	}

	.metric-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.metric-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.metric-change {
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.metric-change.positive {
		background: #d1fae5;
		color: #065f46;
	}

	.metric-comparison {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.before,
	.after {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.before .label,
	.after .label {
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-transform: uppercase;
	}

	.before .value,
	.after .value {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.arrow {
		font-size: 1.5rem;
		color: var(--text-secondary);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--bg-primary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.summary-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.summary-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.estimation-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.estimation-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--bg-primary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
		text-align: center;
	}

	.estimation-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
		text-transform: uppercase;
	}

	.estimation-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.estimation-value.positive {
		color: #10b981;
	}

	.feedback-box {
		padding: 1rem;
		background: var(--bg-primary);
		border-radius: 8px;
		border: 1px solid var(--border-color);
	}

	.feedback-box strong {
		display: block;
		margin-bottom: 0.5rem;
	}

	.feedback-box ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.feedback-box li {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-color);
	}

	.feedback-box li:last-child {
		border-bottom: none;
	}

	.feedback-box li.negative {
		color: #ef4444;
	}

	.feedback-box li.positive {
		color: #10b981;
	}

	.magnitude {
		font-size: 0.875rem;
		color: var(--text-secondary);
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
</style>
