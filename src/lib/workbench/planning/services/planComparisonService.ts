/**
 * VF-320: Plan Comparison Service
 *
 * Service for comparing completed planning sessions:
 * - Quality scoring with AI-based analysis
 * - Section-level diffing
 * - Multi-plan comparison
 * - Merge functionality
 * - Export generation
 */

import type {
	PlanningSession,
	QualityAssessment,
	QualityCriterion,
	CriterionScore,
	PlanComparison,
	MultiPlanComparison,
	SectionDiff,
	PlanSection,
	MergedPlan,
	MergedSection,
	ComparisonReport,
	ExportFormat
} from '../types';
import {
	extractSections,
	compareSections,
	calculateSimilarity,
	calculateCombinedScore
} from '../types/planComparison';

/**
 * Plan Comparison Service
 */
export class PlanComparisonService {
	/**
	 * Score plan quality based on criteria
	 * @param session Planning session to score
	 * @returns Quality assessment
	 */
	scoreQuality(session: PlanningSession): QualityAssessment {
		const plan = session.deliverable?.implementationPlan?.content || '';

		if (!plan || plan.trim().length === 0) {
			return this.createEmptyAssessment(session.id);
		}

		const criterionScores: CriterionScore[] = [
			this.scoreCompleteness(plan),
			this.scoreClarity(plan),
			this.scoreDetail(plan),
			this.scoreFeasibility(plan),
			this.scoreStructure(plan),
			this.scoreBestPractices(plan)
		];

		const overallScore =
			criterionScores.reduce((sum, c) => sum + c.score, 0) / criterionScores.length;

		const { strengths, weaknesses, recommendations } = this.generateFeedback(criterionScores);

		return {
			sessionId: session.id,
			overallScore: Math.round(overallScore),
			criterionScores,
			strengths,
			weaknesses,
			recommendations,
			scoredAt: new Date()
		};
	}

	/**
	 * Create empty quality assessment for sessions with no plan
	 */
	private createEmptyAssessment(sessionId: string): QualityAssessment {
		return {
			sessionId,
			overallScore: 0,
			criterionScores: [],
			strengths: [],
			weaknesses: ['No implementation plan generated'],
			recommendations: ['Complete the planning session to generate a plan'],
			scoredAt: new Date()
		};
	}

	/**
	 * Score completeness (does it cover all requirements?)
	 */
	private scoreCompleteness(plan: string): CriterionScore {
		let score = 0;
		const evidence: string[] = [];

		// Check for key sections
		if (/##\s*overview/i.test(plan)) {
			score += 15;
			evidence.push('Has overview section');
		}
		if (/##\s*phase/i.test(plan)) {
			score += 20;
			evidence.push('Has phase breakdown');
		}
		if (/##\s*(acceptance|success)/i.test(plan)) {
			score += 15;
			evidence.push('Has acceptance criteria');
		}
		if (/##\s*(risk|challenge)/i.test(plan)) {
			score += 10;
			evidence.push('Addresses risks');
		}
		if (/##\s*(timeline|schedule)/i.test(plan)) {
			score += 10;
			evidence.push('Includes timeline');
		}
		if (/##\s*test/i.test(plan)) {
			score += 10;
			evidence.push('Has testing plan');
		}
		if (/##\s*(deploy|release)/i.test(plan)) {
			score += 10;
			evidence.push('Includes deployment plan');
		}
		if (/##\s*(technical|architecture)/i.test(plan)) {
			score += 10;
			evidence.push('Has technical details');
		}

		const explanation =
			score >= 80
				? 'Plan covers all major sections comprehensively'
				: score >= 60
					? 'Plan covers most key sections'
					: score >= 40
						? 'Plan is missing some important sections'
						: 'Plan lacks several critical sections';

		return {
			criterion: 'completeness',
			score,
			explanation,
			evidence
		};
	}

	/**
	 * Score clarity (is it easy to understand?)
	 */
	private scoreClarity(plan: string): CriterionScore {
		let score = 60; // Base score
		const evidence: string[] = [];

		// Check for clear structure
		const sections = plan.match(/^##\s+.+$/gm) || [];
		if (sections.length >= 5) {
			score += 10;
			evidence.push('Well-structured with clear sections');
		}

		// Check for bullet points and lists
		const bulletPoints = (plan.match(/^[-*]\s+/gm) || []).length;
		if (bulletPoints >= 10) {
			score += 10;
			evidence.push('Uses lists for clarity');
		}

		// Check for code blocks
		const codeBlocks = (plan.match(/```/g) || []).length / 2;
		if (codeBlocks >= 2) {
			score += 5;
			evidence.push('Includes code examples');
		}

		// Check for numbered steps
		const numberedSteps = (plan.match(/^\d+\.\s+/gm) || []).length;
		if (numberedSteps >= 5) {
			score += 10;
			evidence.push('Uses numbered steps');
		}

		// Penalize very long paragraphs
		const longParagraphs = plan.split('\n\n').filter((p) => p.length > 500).length;
		if (longParagraphs > 3) {
			score -= 10;
			evidence.push('Some paragraphs are too long');
		}

		score = Math.max(0, Math.min(100, score));

		const explanation =
			score >= 80
				? 'Plan is very clear and easy to follow'
				: score >= 60
					? 'Plan is generally clear with room for improvement'
					: 'Plan could be clearer in structure and presentation';

		return {
			criterion: 'clarity',
			score,
			explanation,
			evidence
		};
	}

	/**
	 * Score detail (does it provide sufficient detail?)
	 */
	private scoreDetail(plan: string): CriterionScore {
		const wordCount = plan.split(/\s+/).length;
		const lineCount = plan.split('\n').length;
		const evidence: string[] = [];

		let score = 0;

		// Word count scoring
		if (wordCount >= 2000) {
			score += 30;
			evidence.push('Comprehensive detail');
		} else if (wordCount >= 1000) {
			score += 20;
			evidence.push('Good level of detail');
		} else if (wordCount >= 500) {
			score += 10;
			evidence.push('Moderate detail');
		}

		// Technical specificity
		const technicalTerms = (
			plan.match(/\b(API|database|component|service|interface|class|function)\b/gi) || []
		).length;
		if (technicalTerms >= 10) {
			score += 20;
			evidence.push('Includes technical specifics');
		}

		// File/path references
		const filePaths = (plan.match(/[\w/]+\.(ts|js|tsx|jsx|py|go|rs|java)/gi) || []).length;
		if (filePaths >= 5) {
			score += 15;
			evidence.push('References specific files');
		}

		// Examples and scenarios
		const examples = (plan.match(/example|scenario|use case/gi) || []).length;
		if (examples >= 3) {
			score += 15;
			evidence.push('Provides examples');
		}

		// Metrics and numbers
		const numbers = (plan.match(/\d+\s*(ms|seconds|minutes|hours|days|MB|GB|%)/gi) || [])
			.length;
		if (numbers >= 5) {
			score += 10;
			evidence.push('Includes specific metrics');
		}

		// Decision rationale
		if (/rationale|because|reason/i.test(plan)) {
			score += 10;
			evidence.push('Explains decisions');
		}

		score = Math.min(100, score);

		const explanation =
			score >= 80
				? 'Plan provides excellent level of detail'
				: score >= 60
					? 'Plan has good detail but could be more specific'
					: 'Plan needs more specific details';

		return {
			criterion: 'detail',
			score,
			explanation,
			evidence
		};
	}

	/**
	 * Score feasibility (is it realistic and achievable?)
	 */
	private scoreFeasibility(plan: string): CriterionScore {
		let score = 70; // Base score (assume feasible unless proven otherwise)
		const evidence: string[] = [];

		// Check for risk awareness
		if (/##\s*(risk|challenge|concern)/i.test(plan)) {
			score += 10;
			evidence.push('Identifies potential risks');
		}

		// Check for realistic timelines
		const unrealisticTerms = (plan.match(/\b(trivial|simple|easy|quick)\b/gi) || []).length;
		if (unrealisticTerms > 5) {
			score -= 10;
			evidence.push('May underestimate complexity');
		}

		// Check for dependency awareness
		if (/depend|require|prerequisite/i.test(plan)) {
			score += 5;
			evidence.push('Considers dependencies');
		}

		// Check for testing and validation
		if (/##\s*test/i.test(plan)) {
			score += 10;
			evidence.push('Includes testing strategy');
		}

		// Check for rollback/mitigation
		if (/rollback|mitigat|fallback|contingency/i.test(plan)) {
			score += 5;
			evidence.push('Has mitigation strategies');
		}

		score = Math.max(0, Math.min(100, score));

		const explanation =
			score >= 80
				? 'Plan appears realistic and achievable'
				: score >= 60
					? 'Plan is generally feasible with some concerns'
					: 'Plan may have feasibility issues';

		return {
			criterion: 'feasibility',
			score,
			explanation,
			evidence
		};
	}

	/**
	 * Score structure (is it well-organized?)
	 */
	private scoreStructure(plan: string): CriterionScore {
		let score = 0;
		const evidence: string[] = [];

		// Count sections and subsections
		const h2Sections = (plan.match(/^##\s+/gm) || []).length;
		const h3Sections = (plan.match(/^###\s+/gm) || []).length;

		if (h2Sections >= 5) {
			score += 25;
			evidence.push('Good section organization');
		}

		if (h3Sections >= 5) {
			score += 15;
			evidence.push('Uses subsections effectively');
		}

		// Check for logical flow (overview → phases → details)
		const firstH2 = plan.match(/^##\s+(.+)$/m)?.[1].toLowerCase() || '';
		if (firstH2.includes('overview') || firstH2.includes('summary')) {
			score += 15;
			evidence.push('Starts with overview');
		}

		// Check for consistent formatting
		const codeBlocks = (plan.match(/```/g) || []).length;
		if (codeBlocks > 0 && codeBlocks % 2 === 0) {
			score += 10;
			evidence.push('Consistent code block formatting');
		}

		// Check for TOC or index
		if (/table of contents|index|##\s*contents/i.test(plan)) {
			score += 10;
			evidence.push('Includes table of contents');
		}

		// Check for proper spacing
		const emptyLines = (plan.match(/\n\n/g) || []).length;
		if (emptyLines >= 10) {
			score += 15;
			evidence.push('Good use of whitespace');
		}

		// Check for headers not following sections (poor structure)
		if (/\n\n##/.test(plan)) {
			score += 10;
		} else {
			score -= 5;
			evidence.push('Some structural issues');
		}

		score = Math.max(0, Math.min(100, score));

		const explanation =
			score >= 80
				? 'Plan is excellently structured'
				: score >= 60
					? 'Plan has good structure'
					: 'Plan structure could be improved';

		return {
			criterion: 'structure',
			score,
			explanation,
			evidence
		};
	}

	/**
	 * Score best practices (does it follow best practices?)
	 */
	private scoreBestPractices(plan: string): CriterionScore {
		let score = 50; // Base score
		const evidence: string[] = [];

		// Check for version control mentions
		if (/git|commit|pull request|PR|branch/i.test(plan)) {
			score += 10;
			evidence.push('Mentions version control');
		}

		// Check for code review
		if (/code review|peer review/i.test(plan)) {
			score += 10;
			evidence.push('Includes code review');
		}

		// Check for documentation
		if (/document|README|changelog|comment/i.test(plan)) {
			score += 10;
			evidence.push('Emphasizes documentation');
		}

		// Check for testing best practices
		if (/unit test|integration test|e2e|test coverage/i.test(plan)) {
			score += 10;
			evidence.push('Follows testing best practices');
		}

		// Check for security considerations
		if (/security|authentication|authorization|encrypt|sanitiz/i.test(plan)) {
			score += 10;
			evidence.push('Addresses security');
		}

		// Check for performance considerations
		if (/performance|optimization|caching|scalability/i.test(plan)) {
			score += 5;
			evidence.push('Considers performance');
		}

		// Check for accessibility
		if (/accessibility|a11y|ARIA|screen reader/i.test(plan)) {
			score += 5;
			evidence.push('Mentions accessibility');
		}

		score = Math.min(100, score);

		const explanation =
			score >= 80
				? 'Plan follows industry best practices'
				: score >= 60
					? 'Plan includes some best practices'
					: 'Plan should incorporate more best practices';

		return {
			criterion: 'best_practices',
			score,
			explanation,
			evidence
		};
	}

	/**
	 * Generate feedback based on criterion scores
	 */
	private generateFeedback(scores: CriterionScore[]): {
		strengths: string[];
		weaknesses: string[];
		recommendations: string[];
	} {
		const strengths: string[] = [];
		const weaknesses: string[] = [];
		const recommendations: string[] = [];

		for (const criterion of scores) {
			if (criterion.score >= 80) {
				strengths.push(`Strong ${criterion.criterion}: ${criterion.explanation}`);
			} else if (criterion.score < 60) {
				weaknesses.push(`Weak ${criterion.criterion}: ${criterion.explanation}`);

				// Generate recommendations based on criterion
				switch (criterion.criterion) {
					case 'completeness':
						recommendations.push('Add missing sections like risks, testing, or deployment');
						break;
					case 'clarity':
						recommendations.push('Use more bullet points and break down long paragraphs');
						break;
					case 'detail':
						recommendations.push('Provide more specific technical details and examples');
						break;
					case 'feasibility':
						recommendations.push('Address potential risks and add mitigation strategies');
						break;
					case 'structure':
						recommendations.push('Improve organization with clear sections and subsections');
						break;
					case 'best_practices':
						recommendations.push('Incorporate industry best practices (testing, security, etc.)');
						break;
				}
			}
		}

		return { strengths, weaknesses, recommendations };
	}

	/**
	 * Compare two planning sessions
	 */
	comparePlans(sessionA: PlanningSession, sessionB: PlanningSession, title?: string): PlanComparison {
		const compId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		// Score quality
		const qualityA = this.scoreQuality(sessionA);
		const qualityB = this.scoreQuality(sessionB);

		// Extract and compare sections
		const planA = sessionA.deliverable?.implementationPlan?.content || '';
		const planB = sessionB.deliverable?.implementationPlan?.content || '';
		const sectionsA = extractSections(planA);
		const sectionsB = extractSections(planB);

		const sectionDiffs = this.generateSectionDiffs(sectionsA, sectionsB);

		// Calculate metrics
		const metricsComparison = this.compareMetrics(sessionA, sessionB);

		// Determine winner
		const winner = this.determineWinner(sessionA, sessionB, qualityA, qualityB);

		return {
			id: compId,
			title: title || `Comparison: ${sessionA.title} vs ${sessionB.title}`,
			sessionA,
			sessionB,
			qualityScores: {
				sessionA: qualityA,
				sessionB: qualityB
			},
			sectionDiffs,
			metricsComparison,
			winner,
			createdAt: new Date()
		};
	}

	/**
	 * Generate section diffs between two plans
	 */
	private generateSectionDiffs(sectionsA: PlanSection[], sectionsB: PlanSection[]): SectionDiff[] {
		const diffs: SectionDiff[] = [];
		const matchedB = new Set<number>();

		// Compare sections by type and title
		for (const sectionA of sectionsA) {
			let matched = false;

			for (let i = 0; i < sectionsB.length; i++) {
				const sectionB = sectionsB[i];

				if (matchedB.has(i)) continue;

				// Match by type or similar title
				if (
					sectionA.type === sectionB.type ||
					calculateSimilarity(sectionA.title, sectionB.title) >= 70
				) {
					diffs.push(compareSections(sectionA, sectionB));
					matchedB.add(i);
					matched = true;
					break;
				}
			}

			if (!matched) {
				// Section removed
				diffs.push(compareSections(sectionA, undefined));
			}
		}

		// Find added sections
		for (let i = 0; i < sectionsB.length; i++) {
			if (!matchedB.has(i)) {
				diffs.push(compareSections(undefined, sectionsB[i]));
			}
		}

		return diffs;
	}

	/**
	 * Compare metrics between two sessions
	 */
	private compareMetrics(sessionA: PlanningSession, sessionB: PlanningSession) {
		const durationA =
			sessionA.completedAt && sessionA.startedAt
				? sessionA.completedAt.getTime() - sessionA.startedAt.getTime()
				: 0;
		const durationB =
			sessionB.completedAt && sessionB.startedAt
				? sessionB.completedAt.getTime() - sessionB.startedAt.getTime()
				: 0;

		return {
			sessionA: {
				totalTokens: sessionA.totalTokens,
				totalCost: sessionA.totalCost,
				durationMs: durationA,
				stageCount: sessionA.stages.length
			},
			sessionB: {
				totalTokens: sessionB.totalTokens,
				totalCost: sessionB.totalCost,
				durationMs: durationB,
				stageCount: sessionB.stages.length
			},
			differences: {
				tokenDiff: sessionB.totalTokens - sessionA.totalTokens,
				costDiff: sessionB.totalCost - sessionA.totalCost,
				durationDiff: durationB - durationA,
				stageDiff: sessionB.stages.length - sessionA.stages.length
			}
		};
	}

	/**
	 * Determine winner between two sessions
	 */
	private determineWinner(
		sessionA: PlanningSession,
		sessionB: PlanningSession,
		qualityA: QualityAssessment,
		qualityB: QualityAssessment
	): PlanComparison['winner'] {
		const durationA =
			sessionA.completedAt && sessionA.startedAt
				? sessionA.completedAt.getTime() - sessionA.startedAt.getTime()
				: 0;
		const durationB =
			sessionB.completedAt && sessionB.startedAt
				? sessionB.completedAt.getTime() - sessionB.startedAt.getTime()
				: 0;

		const maxCost = Math.max(sessionA.totalCost, sessionB.totalCost);
		const maxDuration = Math.max(durationA, durationB);

		const scoreA = calculateCombinedScore(
			qualityA.overallScore,
			sessionA.totalCost,
			durationA,
			maxCost,
			maxDuration
		);
		const scoreB = calculateCombinedScore(
			qualityB.overallScore,
			sessionB.totalCost,
			durationB,
			maxCost,
			maxDuration
		);

		if (scoreA > scoreB) {
			return {
				sessionId: sessionA.id,
				reason: 'combined',
				score: scoreA
			};
		} else if (scoreB > scoreA) {
			return {
				sessionId: sessionB.id,
				reason: 'combined',
				score: scoreB
			};
		}

		return null; // Tie
	}
}

/**
 * Singleton instance
 */
export const planComparisonService = new PlanComparisonService();
