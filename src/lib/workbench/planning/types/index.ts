/**
 * Planning Types for Cortex Multi-AI Planning Orchestrator
 * Complete type system for 4-stage planning workflow
 */

import {
	compareSections as compareVersionSections,
	extractSections,
	type PlanSection,
	type SectionDiff
} from './planComparison';

// ==============================================================================
// ENUMS
// ==============================================================================

/**
 * Stage types in the 4-stage workflow
 */
export type StageType = 'initial' | 'review' | 'refinement' | 'final';

/**
 * Stage execution status
 */
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * LLM providers
 */
export type Provider = 'anthropic' | 'openai' | 'xai' | 'google';

/**
 * Request types for planning
 */
export type RequestType = 'feature' | 'refactor' | 'bugfix' | 'analysis' | 'architecture';

/**
 * Planning session status
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Pipeline types
 */
export type PipelineType = 'default' | 'quick' | 'deep';

// ==============================================================================
// MODEL CALL TYPES
// ==============================================================================

/**
 * Options for calling an LLM
 */
export interface ModelCallOptions {
	/** Model identifier (e.g., 'claude-3-5-sonnet-20241022') */
	model: string;
	/** Provider */
	provider: Provider;
	/** User prompt */
	prompt: string;
	/** System prompt (optional) */
	systemPrompt?: string;
	/** Max tokens to generate */
	maxTokens?: number;
	/** Temperature (0-1) */
	temperature?: number;
	/** Streaming progress callback */
	onProgress?: (token: string) => void;
	/** Abort signal */
	signal?: AbortSignal;
}

/**
 * Result from an LLM call
 */
export interface ModelCallResult {
	/** Generated content */
	content: string;
	/** Tokens used (prompt + completion) */
	tokensUsed: {
		prompt: number;
		completion: number;
		total: number;
	};
	/** Cost in USD */
	cost: number;
	/** Model used */
	model: string;
	/** Provider */
	provider: Provider;
	/** Duration in milliseconds */
	durationMs: number;
	/** Finish reason */
	finishReason?: 'stop' | 'length' | 'content_filter' | 'error';
}

// ==============================================================================
// STAGE CONFIGURATION
// ==============================================================================

/**
 * Configuration for a single stage
 */
export interface StageConfig {
	/** Stage type */
	type: StageType;
	/** Stage name */
	name: string;
	/** Provider to use */
	provider: Provider;
	/** Model to use */
	model: string;
	/** System prompt template */
	systemPrompt: string;
	/** User prompt template */
	promptTemplate: string;
	/** Max tokens */
	maxTokens: number;
	/** Temperature */
	temperature: number;
	/** Whether this stage can be skipped */
	skippable: boolean;
}

// ==============================================================================
// PLANNING STAGE
// ==============================================================================

/**
 * A single stage in the planning workflow
 */
export interface PlanningStage {
	/** Unique stage ID */
	id: string;
	/** Stage index (0-based) */
	index: number;
	/** Stage configuration */
	config: StageConfig;
	/** Current status */
	status: StageStatus;
	/** Input prompt */
	input: string;
	/** Generated output */
	output: string;
	/** Streaming output (during execution) */
	streamingOutput?: string;
	/** Model call result */
	result: ModelCallResult | null;
	/** Error message if failed */
	error: string | null;
	/** Start timestamp */
	startedAt: Date | null;
	/** Completion timestamp */
	completedAt: Date | null;
	/** Context from previous stages */
	previousContext: string[];
	/** User injections for this stage */
	userInjections: string[];
}

// ==============================================================================
// PIPELINE CONFIGURATION
// ==============================================================================

/**
 * Pipeline configuration (pre-defined workflows)
 */
export interface PipelineConfig {
	/** Pipeline name */
	name: string;
	/** Pipeline type */
	type: PipelineType;
	/** Description */
	description: string;
	/** Stage configurations */
	stages: StageConfig[];
	/** Estimated duration (minutes) */
	estimatedDuration: number;
	/** Maximum iterations for refinement */
	maxIterations: number;
}

// ==============================================================================
// TWO-FILE DELIVERABLE
// ==============================================================================

/**
 * The two-file deliverable output
 */
export interface TwoFileDeliverable {
	/** Implementation plan */
	implementationPlan: {
		content: string;
		filename: string;
	};
	/** Claude Code execution prompt */
	claudeCodePrompt: {
		content: string;
		filename: string;
	};
	/** Extracted metadata */
	metadata: {
		title: string;
		estimatedTime: string;
		phases: string[];
		successCriteria: string[];
	};
}

// ==============================================================================
// PLANNING SESSION
// ==============================================================================

/**
 * A complete planning session
 */
export interface PlanningSession {
	/** Unique session ID */
	id: string;
	/** User's request title */
	title: string;
	/** User's request description */
	description: string;
	/** Request type */
	requestType: RequestType;
	/** Pipeline used */
	pipeline: PipelineConfig;
	/** Current session status */
	status: SessionStatus;
	/** All stages in this session */
	stages: PlanningStage[];
	/** Current stage index */
	currentStageIndex: number;
	/** Final deliverable (when completed) */
	deliverable: TwoFileDeliverable | null;
	/** Total tokens used */
	totalTokens: number;
	/** Total cost in USD */
	totalCost: number;
	/** Session created timestamp */
	createdAt: Date;
	/** Session started timestamp */
	startedAt: Date | null;
	/** Session paused timestamp */
	pausedAt: Date | null;
	/** Session completed timestamp */
	completedAt: Date | null;
	/** Error message if failed */
	error: string | null;
	/** User who created the session */
	userId: string;
	/** Workspace ID */
	workspaceId: string;
}

// ==============================================================================
// CONTEXT INJECTION
// ==============================================================================

/**
 * User context injection
 */
export interface ContextInjection {
	/** Stage index to inject at */
	stageIndex: number;
	/** Context content */
	content: string;
	/** Injection timestamp */
	injectedAt: Date;
}

// ==============================================================================
// PROGRESS EVENT
// ==============================================================================

/**
 * Progress event for streaming
 */
export interface ProgressEvent {
	type: 'token' | 'stage_start' | 'stage_complete' | 'session_complete' | 'error';
	sessionId: string;
	stageIndex?: number;
	data?: any;
	timestamp: Date;
}

// ==============================================================================
// DEFAULT CONFIGURATIONS
// ==============================================================================

/**
 * Default stage configurations
 */
export const DEFAULT_STAGE_CONFIGS: Record<StageType, Omit<StageConfig, 'type' | 'name'>> = {
	initial: {
		provider: 'openai',
		model: 'gpt-4-turbo-2024-04-09',
		systemPrompt: 'You are an expert software architect helping plan implementation details.',
		promptTemplate:
			'Create an initial implementation plan for:\n\n{description}\n\nInclude:\n1. Overview\n2. Architecture\n3. Components\n4. Data Models\n5. Implementation Phases\n6. Testing Strategy\n7. Potential Challenges',
		maxTokens: 4000,
		temperature: 0.7,
		skippable: false
	},
	review: {
		provider: 'anthropic',
		model: 'claude-3-5-sonnet-20241022',
		systemPrompt:
			'You are a technical reviewer providing constructive feedback on implementation plans.',
		promptTemplate:
			'Review this implementation plan and provide:\n\n✅ Strengths\n⚠️ Concerns\n💡 Improvements\n❓ Questions\n\nPlan:\n{previousOutput}',
		maxTokens: 3000,
		temperature: 0.6,
		skippable: false
	},
	refinement: {
		provider: 'openai',
		model: 'gpt-4-turbo-2024-04-09',
		systemPrompt: 'You are refining an implementation plan based on review feedback.',
		promptTemplate:
			'Address the review feedback and create an improved plan.\n\nOriginal Plan:\n{initialOutput}\n\nReview Feedback:\n{reviewOutput}\n\nProvide a complete, standalone improved plan.',
		maxTokens: 4500,
		temperature: 0.7,
		skippable: true
	},
	final: {
		provider: 'anthropic',
		model: 'claude-3-5-sonnet-20241022',
		systemPrompt:
			'You are creating the final two-file deliverable for autonomous execution by Claude Code.',
		promptTemplate:
			'Create the final two-file deliverable:\n\n---BEGIN IMPLEMENTATION PLAN---\n[Complete architecture, code examples, tests, success criteria]\n---END IMPLEMENTATION PLAN---\n\n---BEGIN CLAUDE CODE PROMPT---\n[Phase-by-phase autonomous execution instructions]\n---END CLAUDE CODE PROMPT---\n\nRefined Plan:\n{refinedOutput}',
		maxTokens: 8000,
		temperature: 0.5,
		skippable: false
	}
};

/**
 * Default pipeline: 4-stage ChatGPT ↔ Claude workflow
 */
export const DEFAULT_PLANNING_CONFIG: PipelineConfig = {
	name: 'Default (4-Stage)',
	type: 'default',
	description: 'ChatGPT → Claude → ChatGPT → Claude for balanced planning',
	stages: [
		{ type: 'initial', name: 'Initial Plan', ...DEFAULT_STAGE_CONFIGS.initial },
		{ type: 'review', name: 'Review', ...DEFAULT_STAGE_CONFIGS.review },
		{ type: 'refinement', name: 'Refinement', ...DEFAULT_STAGE_CONFIGS.refinement },
		{ type: 'final', name: 'Final Deliverable', ...DEFAULT_STAGE_CONFIGS.final }
	],
	estimatedDuration: 5, // minutes
	maxIterations: 2 // Allow 2 cycles through refinement
};

/**
 * Quick pipeline: 2-stage for faster planning
 */
export const QUICK_PLANNING_CONFIG: PipelineConfig = {
	name: 'Quick (2-Stage)',
	type: 'quick',
	description: 'ChatGPT → Claude for rapid planning',
	stages: [
		{ type: 'initial', name: 'Initial Plan', ...DEFAULT_STAGE_CONFIGS.initial },
		{ type: 'final', name: 'Final Deliverable', ...DEFAULT_STAGE_CONFIGS.final }
	],
	estimatedDuration: 3,
	maxIterations: 1
};

/**
 * Deep pipeline: 6-stage for comprehensive planning
 */
export const DEEP_PLANNING_CONFIG: PipelineConfig = {
	name: 'Deep (6-Stage)',
	type: 'deep',
	description: 'Extended workflow with multiple review cycles',
	stages: [
		{ type: 'initial', name: 'Initial Plan', ...DEFAULT_STAGE_CONFIGS.initial },
		{ type: 'review', name: 'Review 1', ...DEFAULT_STAGE_CONFIGS.review },
		{ type: 'refinement', name: 'Refinement 1', ...DEFAULT_STAGE_CONFIGS.refinement },
		{ type: 'review', name: 'Review 2', ...DEFAULT_STAGE_CONFIGS.review },
		{ type: 'refinement', name: 'Refinement 2', ...DEFAULT_STAGE_CONFIGS.refinement },
		{ type: 'final', name: 'Final Deliverable', ...DEFAULT_STAGE_CONFIGS.final }
	],
	estimatedDuration: 10,
	maxIterations: 3
};

/**
 * All available pipelines
 */
export const PIPELINES: Record<PipelineType, PipelineConfig> = {
	default: DEFAULT_PLANNING_CONFIG,
	quick: QUICK_PLANNING_CONFIG,
	deep: DEEP_PLANNING_CONFIG
};

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Get pipeline by type
 */
export function getPipeline(type: PipelineType): PipelineConfig {
	return PIPELINES[type];
}

/**
 * List all available pipelines
 */
export function listPipelines(): PipelineConfig[] {
	return Object.values(PIPELINES);
}

/**
 * Estimate cost for a pipeline
 */
export function estimatePipelineCost(pipeline: PipelineConfig): number {
	// Rough estimates based on average token usage
	const costPerStage: Record<Provider, number> = {
		anthropic: 0.15, // ~$0.15 per stage (Claude 3.5 Sonnet)
		openai: 0.12, // ~$0.12 per stage (GPT-4 Turbo)
		xai: 0.10, // ~$0.10 per stage (Grok)
		google: 0.08 // ~$0.08 per stage (Gemini)
	};

	return pipeline.stages.reduce((total, stage) => {
		return total + costPerStage[stage.provider];
	}, 0);
}

/**
 * Create a new planning session
 */
export function createPlanningSession(
	title: string,
	description: string,
	requestType: RequestType,
	pipelineType: PipelineType = 'default',
	userId: string = 'anonymous',
	workspaceId: string = 'default'
): PlanningSession {
	const pipeline = getPipeline(pipelineType);
	const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	const stages: PlanningStage[] = pipeline.stages.map((config, index) => ({
		id: `${sessionId}_stage_${index}`,
		index,
		config,
		status: index === 0 ? 'pending' : 'pending',
		input: '',
		output: '',
		streamingOutput: undefined,
		result: null,
		error: null,
		startedAt: null,
		completedAt: null,
		previousContext: [],
		userInjections: []
	}));

	return {
		id: sessionId,
		title,
		description,
		requestType,
		pipeline,
		status: 'active',
		stages,
		currentStageIndex: 0,
		deliverable: null,
		totalTokens: 0,
		totalCost: 0,
		createdAt: new Date(),
		startedAt: null,
		pausedAt: null,
		completedAt: null,
		error: null,
		userId,
		workspaceId
	};
}

/**
 * Get current stage from session
 */
export function getCurrentStage(session: PlanningSession): PlanningStage | null {
	if (session.currentStageIndex >= session.stages.length) {
		return null;
	}
	return session.stages[session.currentStageIndex];
}

/**
 * Check if session is complete
 */
export function isSessionComplete(session: PlanningSession): boolean {
	return session.status === 'completed' || session.currentStageIndex >= session.stages.length;
}

/**
 * Get session progress percentage
 */
export function getSessionProgress(session: PlanningSession): number {
	if (session.stages.length === 0) return 0;
	const completedStages = session.stages.filter((s) => s.status === 'completed').length;
	return Math.round((completedStages / session.stages.length) * 100);
}

// ==============================================================================
// MODEL COMPARISON TYPES
// ==============================================================================

/**
 * Comparison run configuration
 */
export interface ComparisonConfig {
	/** Pipeline configurations to compare */
	pipelines: PipelineType[];
	/** Whether to run in parallel */
	parallel: boolean;
}

/**
 * Comparison run state
 */
export type ComparisonStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Model comparison run
 * Runs the same request through multiple pipelines
 */
export interface ComparisonRun {
	/** Unique ID */
	id: string;
	/** Request title */
	title: string;
	/** Request description */
	description: string;
	/** Request type */
	requestType: RequestType;
	/** Comparison configuration */
	config: ComparisonConfig;
	/** Status */
	status: ComparisonStatus;
	/** Individual planning sessions (one per pipeline) */
	sessions: Map<PipelineType, PlanningSession>;
	/** Created timestamp */
	createdAt: Date;
	/** Started timestamp */
	startedAt: Date | null;
	/** Completed timestamp */
	completedAt: Date | null;
	/** Error message if failed */
	error: string | null;
	/** User ID */
	userId?: string;
	/** Workspace ID */
	workspaceId?: string;
}

/**
 * Comparison metrics for analysis
 */
export interface ComparisonMetrics {
	/** Pipeline type */
	pipeline: PipelineType;
	/** Total tokens used */
	totalTokens: number;
	/** Total cost */
	totalCost: number;
	/** Total duration in milliseconds */
	durationMs: number;
	/** Success rate (completed stages / total stages) */
	successRate: number;
	/** Average tokens per stage */
	avgTokensPerStage: number;
	/** Status */
	status: SessionStatus;
}

/**
 * Comparison result summary
 */
export interface ComparisonResult {
	/** Comparison run ID */
	runId: string;
	/** Title */
	title: string;
	/** Metrics for each pipeline */
	metrics: Map<PipelineType, ComparisonMetrics>;
	/** Winner (lowest cost) */
	winner: {
		pipeline: PipelineType;
		reason: 'cost' | 'quality' | 'speed';
	} | null;
	/** Created timestamp */
	createdAt: Date;
}

// ==============================================================================
// COMPARISON HELPER FUNCTIONS
// ==============================================================================

/**
 * Create a new comparison run
 */
export function createComparisonRun(
	title: string,
	description: string,
	requestType: RequestType,
	pipelines: PipelineType[],
	parallel: boolean = true,
	userId?: string,
	workspaceId?: string
): ComparisonRun {
	const timestamp = Date.now();
	const randomStr = Math.random().toString(36).substr(2, 9);
	const runId = `comp_${timestamp}_${randomStr}`;

	// Create a session for each pipeline
	const sessions = new Map<PipelineType, PlanningSession>();
	for (const pipelineType of pipelines) {
		const session = createPlanningSession(
			`${title} (${pipelineType})`,
			description,
			requestType,
			pipelineType,
			userId,
			workspaceId
		);
		sessions.set(pipelineType, session);
	}

	return {
		id: runId,
		title,
		description,
		requestType,
		config: {
			pipelines,
			parallel
		},
		status: 'pending',
		sessions,
		createdAt: new Date(),
		startedAt: null,
		completedAt: null,
		error: null,
		userId,
		workspaceId
	};
}

/**
 * Calculate metrics for a session
 */
export function calculateSessionMetrics(
	session: PlanningSession,
	pipelineType: PipelineType
): ComparisonMetrics {
	const completedStages = session.stages.filter((s) => s.status === 'completed').length;
	const successRate =
		session.stages.length > 0 ? (completedStages / session.stages.length) * 100 : 0;

	const durationMs =
		session.completedAt && session.startedAt
			? session.completedAt.getTime() - session.startedAt.getTime()
			: 0;

	const avgTokensPerStage = completedStages > 0 ? session.totalTokens / completedStages : 0;

	return {
		pipeline: pipelineType,
		totalTokens: session.totalTokens,
		totalCost: session.totalCost,
		durationMs,
		successRate,
		avgTokensPerStage,
		status: session.status
	};
}

/**
 * Generate comparison result from run
 */
export function generateComparisonResult(run: ComparisonRun): ComparisonResult {
	const metrics = new Map<PipelineType, ComparisonMetrics>();

	// Calculate metrics for each session
	run.sessions.forEach((session, pipelineType) => {
		const sessionMetrics = calculateSessionMetrics(session, pipelineType);
		metrics.set(pipelineType, sessionMetrics);
	});

	// Determine winner (lowest cost among completed sessions)
	let winner: ComparisonResult['winner'] = null;
	let lowestCost = Infinity;

	metrics.forEach((metric, pipeline) => {
		if (metric.status === 'completed' && metric.totalCost < lowestCost) {
			lowestCost = metric.totalCost;
			winner = { pipeline, reason: 'cost' };
		}
	});

	return {
		runId: run.id,
		title: run.title,
		metrics,
		winner,
		createdAt: run.createdAt
	};
}

/**
 * Check if comparison run is complete
 */
export function isComparisonComplete(run: ComparisonRun): boolean {
	if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
		return true;
	}

	// Check if all sessions are complete
	const allComplete = Array.from(run.sessions.values()).every((session) =>
		isSessionComplete(session)
	);

	return allComplete;
}

// ==============================================================================
// VF-321: PLAN VERSIONING & ITERATIVE REFINEMENT
// ==============================================================================

/**
 * A snapshot of a plan at a specific version
 */
export interface PlanVersion {
	/** Version number (1, 2, 3, etc.) */
	version: number;
	/** Deliverable at this version */
	deliverable: TwoFileDeliverable;
	/** Total tokens used up to this version */
	totalTokens: number;
	/** Total cost up to this version */
	totalCost: number;
	/** Stages executed for this version */
	stages: PlanningStage[];
	/** Refinement request that led to this version (null for v1) */
	refinementRequest: RefinementRequest | null;
	/** Timestamp when this version was created */
	createdAt: Date;
	/** Session status at this version */
	status: SessionStatus;
}

/**
 * A request to refine an existing plan
 */
export interface RefinementRequest {
	/** New requirements to incorporate */
	requirements: string[];
	/** Additional context or constraints */
	additionalContext?: string;
	/** Specific sections to focus on (optional) */
	focusSections?: string[];
	/** Requested by user */
	requestedBy: string;
	/** Requested timestamp */
	requestedAt: Date;
}

/**
 * Difference between two plan versions
 */
export interface PlanDiff {
	/** Version A (older) */
	versionA: number;
	/** Version B (newer) */
	versionB: number;
	/** Section-level diffs (reuse from VF-320) */
	sectionDiffs: SectionDiff[];
	/** Added requirements */
	addedRequirements: string[];
	/** Metrics comparison */
	metricsChange: {
		tokensDiff: number;
		costDiff: number;
		durationDiff: number;
	};
	/** Summary of changes */
	summary: string;
}

/**
 * Enhanced PlanningSession with version tracking
 */
export interface PlanningSessionWithVersions extends PlanningSession {
	/** Version history (v1, v2, v3, etc.) */
	versionHistory: PlanVersion[];
	/** Current version number */
	currentVersion: number;
	/** Parent session ID (if this was refined from another session) */
	parentSessionId: string | null;
	/** Is this session a refinement of another? */
	isRefinement: boolean;
}

// ==============================================================================
// VERSIONING HELPER FUNCTIONS
// ==============================================================================

/**
 * Create a version snapshot from current session
 */
export function createPlanVersion(
	session: PlanningSession,
	versionNumber: number,
	refinementRequest: RefinementRequest | null
): PlanVersion {
	if (!session.deliverable) {
		throw new Error('Cannot create version: session has no deliverable');
	}

	return {
		version: versionNumber,
		deliverable: session.deliverable,
		totalTokens: session.totalTokens,
		totalCost: session.totalCost,
		stages: session.stages.map((stage) => ({ ...stage })), // Deep copy
		refinementRequest,
		createdAt: new Date(),
		status: session.status
	};
}

/**
 * Create a refinement request
 */
export function createRefinementRequest(
	requirements: string[],
	userId: string,
	additionalContext?: string,
	focusSections?: string[]
): RefinementRequest {
	return {
		requirements,
		additionalContext,
		focusSections,
		requestedBy: userId,
		requestedAt: new Date()
	};
}

/**
 * Compare two plan versions
 */
export function comparePlanVersions(
	versionA: PlanVersion,
	versionB: PlanVersion
): PlanDiff {
	// Extract sections from both plans
	const sectionsA = extractSections(versionA.deliverable.implementationPlan.content);
	const sectionsB = extractSections(versionB.deliverable.implementationPlan.content);

	// Generate section diffs
	const sectionDiffs: SectionDiff[] = [];
	const sectionMap = new Map<string, PlanSection>();

	// Map sections by title for matching
	sectionsB.forEach((section) => {
		sectionMap.set(section.title, section);
	});

	// Compare sections
	sectionsA.forEach((sectionA) => {
		const sectionB = sectionMap.get(sectionA.title);
		const diff = compareVersionSections(sectionA, sectionB);
		sectionDiffs.push(diff);
		if (sectionB) {
			sectionMap.delete(sectionA.title);
		}
	});

	// Add remaining sections from B (newly added)
	sectionMap.forEach((sectionB) => {
		const diff = compareVersionSections(undefined, sectionB);
		sectionDiffs.push(diff);
	});

	// Extract added requirements
	const addedRequirements = versionB.refinementRequest?.requirements || [];

	// Calculate metrics change
	const metricsChange = {
		tokensDiff: versionB.totalTokens - versionA.totalTokens,
		costDiff: versionB.totalCost - versionA.totalCost,
		durationDiff: versionB.stages.length - versionA.stages.length
	};

	// Generate summary
	const addedCount = sectionDiffs.filter((d) => d.type === 'added').length;
	const removedCount = sectionDiffs.filter((d) => d.type === 'removed').length;
	const changedCount = sectionDiffs.filter((d) => d.type === 'changed').length;

	const summary = `Version ${versionB.version} vs ${versionA.version}: ${addedCount} sections added, ${removedCount} removed, ${changedCount} changed. ${addedRequirements.length} new requirements incorporated.`;

	return {
		versionA: versionA.version,
		versionB: versionB.version,
		sectionDiffs,
		addedRequirements,
		metricsChange,
		summary
	};
}

/**
 * Get a specific version from session history
 */
export function getPlanVersion(
	session: PlanningSessionWithVersions,
	version: number
): PlanVersion | null {
	return session.versionHistory.find((v) => v.version === version) || null;
}

/**
 * Get latest version from session
 */
export function getLatestVersion(session: PlanningSessionWithVersions): PlanVersion | null {
	if (session.versionHistory.length === 0) return null;
	return session.versionHistory[session.versionHistory.length - 1];
}

/**
 * Initialize a session with version tracking
 */
export function createVersionedPlanningSession(
	title: string,
	description: string,
	requestType: RequestType,
	pipelineType: PipelineType = 'default',
	userId: string = 'anonymous',
	workspaceId: string = 'default',
	parentSessionId: string | null = null
): PlanningSessionWithVersions {
	const baseSession = createPlanningSession(
		title,
		description,
		requestType,
		pipelineType,
		userId,
		workspaceId
	);

	return {
		...baseSession,
		versionHistory: [],
		currentVersion: 0,
		parentSessionId,
		isRefinement: parentSessionId !== null
	};
}

// ==============================================================================
// VF-320: PLAN COMPARISON (re-export from planComparison.ts)
// ==============================================================================

export type {
	QualityCriterion,
	CriterionScore,
	QualityAssessment,
	DiffType,
	PlanSection,
	SectionDiff,
	PlanComparison,
	MultiPlanComparison,
	MergedSection,
	MergedPlan,
	ExportFormat,
	ComparisonReport
} from './planComparison';

export {
	calculateSimilarity,
	extractSections,
	compareSections,
	calculateCombinedScore
} from './planComparison';

// ==============================================================================
// VF-322: MULTI-PATH PLANNING
// ==============================================================================

/**
 * Planning variant types
 */
export type VariantType = 'optimistic' | 'conservative' | 'experimental';

/**
 * Variant configuration
 */
export interface VariantConfig {
	/** Variant type */
	type: VariantType;
	/** Variant name */
	name: string;
	/** Description of this variant's approach */
	description: string;
	/** Model to use for this variant */
	model: string;
	/** Provider */
	provider: Provider;
	/** Temperature (0-1) */
	temperature: number;
	/** System prompt override (optional) */
	systemPromptOverride?: string;
	/** User prompt template override (optional) */
	promptTemplateOverride?: string;
	/** Max tokens */
	maxTokens: number;
	/** Assumptions this variant makes */
	assumptions: string[];
	/** Risk level (1-5, 1=low, 5=high) */
	riskLevel: number;
}

/**
 * Multi-path planning execution
 */
export interface MultiPathExecution {
	/** Unique execution ID */
	id: string;
	/** User's request */
	title: string;
	description: string;
	requestType: RequestType;
	/** Variants to execute */
	variants: VariantConfig[];
	/** Execute in parallel or sequential */
	parallel: boolean;
	/** Budget constraint (optional) */
	maxCostUSD?: number;
	/** Current status */
	status: 'pending' | 'running' | 'completed' | 'failed' | 'budget_exceeded';
	/** Individual sessions per variant */
	sessions: Map<VariantType, PlanningSession>;
	/** Cost tracking */
	totalCost: number;
	/** Created timestamp */
	createdAt: Date;
	/** Started timestamp */
	startedAt: Date | null;
	/** Completed timestamp */
	completedAt: Date | null;
	/** Error message if failed */
	error: string | null;
	/** User ID */
	userId: string;
	/** Workspace ID */
	workspaceId: string;
}

/**
 * Variant comparison result
 */
export interface VariantComparison {
	/** Execution ID */
	executionId: string;
	/** Variant comparisons */
	variants: Map<
		VariantType,
		{
			session: PlanningSession;
			deliverable: TwoFileDeliverable;
			metrics: {
				totalTokens: number;
				totalCost: number;
				durationMs: number;
				qualityScore: number; // 0-100
			};
			strengths: string[];
			weaknesses: string[];
		}
	>;
	/** Winner (best overall) */
	winner: VariantType | null;
	/** Recommended approach */
	recommendation: {
		variant: VariantType;
		reason: string;
		confidence: number; // 0-1
	} | null;
	/** Created timestamp */
	createdAt: Date;
}

/**
 * Merged plan (combining best aspects)
 */
export interface MergedVariantPlan {
	/** Merged deliverable */
	deliverable: TwoFileDeliverable;
	/** Source variants (which parts came from which variant) */
	sources: {
		section: string;
		sourceVariant: VariantType;
		reason: string;
	}[];
	/** Merge strategy used */
	strategy: 'best_of_each' | 'weighted_average' | 'manual';
	/** Quality score of merged plan */
	qualityScore: number;
	/** Created timestamp */
	createdAt: Date;
}

// ==============================================================================
// DEFAULT VARIANT CONFIGURATIONS
// ==============================================================================

/**
 * Optimistic variant: Fast timeline, assumes best-case scenario
 */
export const OPTIMISTIC_VARIANT: VariantConfig = {
	type: 'optimistic',
	name: 'Optimistic Plan',
	description:
		'Fast timeline with best-case assumptions. Assumes smooth execution, minimal blockers, and ideal conditions.',
	model: 'gpt-4-turbo-2024-04-09',
	provider: 'openai',
	temperature: 0.8, // Higher temperature for creative, ambitious solutions
	maxTokens: 4000,
	assumptions: [
		'Team has all necessary expertise',
		'No major blockers or dependencies',
		'Requirements are clear and stable',
		'Resources are readily available',
		'Testing and deployment go smoothly'
	],
	riskLevel: 4 // Higher risk due to optimistic assumptions
};

/**
 * Conservative variant: Realistic timeline, includes contingencies
 */
export const CONSERVATIVE_VARIANT: VariantConfig = {
	type: 'conservative',
	name: 'Conservative Plan',
	description:
		'Realistic timeline with buffer time. Includes contingency plans, assumes moderate complexity and potential blockers.',
	model: 'claude-3-5-sonnet-20241022',
	provider: 'anthropic',
	temperature: 0.5, // Lower temperature for careful, thorough planning
	maxTokens: 5000,
	assumptions: [
		'Some requirements may change',
		'Technical challenges will arise',
		'Dependencies may cause delays',
		'Testing will uncover issues',
		'Buffer time needed for unknowns'
	],
	riskLevel: 2 // Lower risk, more realistic
};

/**
 * Experimental variant: Novel approaches, higher risk/reward
 */
export const EXPERIMENTAL_VARIANT: VariantConfig = {
	type: 'experimental',
	name: 'Experimental Plan',
	description:
		'Explores novel approaches and cutting-edge solutions. May involve unproven technologies or innovative architectures.',
	model: 'gpt-4-turbo-2024-04-09',
	provider: 'openai',
	temperature: 0.9, // Highest temperature for maximum creativity
	maxTokens: 4500,
	assumptions: [
		'Team willing to experiment',
		'Time for R&D and exploration',
		'Acceptable risk of failure',
		'Learning is a primary goal',
		'Innovation is valued over safety'
	],
	riskLevel: 5 // Highest risk, most innovative
};

/**
 * All default variants
 */
export const DEFAULT_VARIANTS: Record<VariantType, VariantConfig> = {
	optimistic: OPTIMISTIC_VARIANT,
	conservative: CONSERVATIVE_VARIANT,
	experimental: EXPERIMENTAL_VARIANT
};

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Create a multi-path execution
 */
export function createMultiPathExecution(
	title: string,
	description: string,
	requestType: RequestType,
	variants: VariantType[] = ['optimistic', 'conservative', 'experimental'],
	parallel: boolean = true,
	maxCostUSD?: number,
	userId: string = 'anonymous',
	workspaceId: string = 'default'
): MultiPathExecution {
	const timestamp = Date.now();
	const randomStr = Math.random().toString(36).substr(2, 9);
	const executionId = `multipath_${timestamp}_${randomStr}`;

	// Create sessions for each variant
	const sessions = new Map<VariantType, PlanningSession>();
	for (const variantType of variants) {
		const variantConfig = DEFAULT_VARIANTS[variantType];
		const session = createPlanningSession(
			`${title} (${variantConfig.name})`,
			description,
			requestType,
			'default', // Use default pipeline
			userId,
			workspaceId
		);
		sessions.set(variantType, session);
	}

	const variantConfigs = variants.map((v) => DEFAULT_VARIANTS[v]);

	return {
		id: executionId,
		title,
		description,
		requestType,
		variants: variantConfigs,
		parallel,
		maxCostUSD,
		status: 'pending',
		sessions,
		totalCost: 0,
		createdAt: new Date(),
		startedAt: null,
		completedAt: null,
		error: null,
		userId,
		workspaceId
	};
}

/**
 * Get variant configuration
 */
export function getVariantConfig(type: VariantType): VariantConfig {
	return DEFAULT_VARIANTS[type];
}

/**
 * Calculate total estimated cost for multi-path execution
 */
export function estimateMultiPathCost(variants: VariantType[]): number {
	// Rough estimate: ~$0.30 per variant (assumes full pipeline)
	return variants.length * 0.3;
}
