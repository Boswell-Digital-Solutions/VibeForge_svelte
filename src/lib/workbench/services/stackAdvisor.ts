/**
 * Stack Advisor Service
 * Phase 3.5: Enhanced Stack Advisor
 *
 * Intelligent stack recommendation engine with:
 * - Weighted scoring algorithm
 * - Historical success analysis
 * - User preference learning
 * - Explainable AI recommendations
 */

import type {
  TechStack,
  StackScore,
  ScoreComponents,
  ConfidenceLevel,
  RecommendationExplanation,
  ExplanationFactor,
  StackHistoricalData,
  UserPreferences,
  CalculateScoresRequest,
  StackRecommendationResponse,
  ScoringWeights,
} from '../types/stack-advisor';
import { DEFAULT_WEIGHTS } from '../types/stack-advisor';
import { projectOutcomesStore } from '$lib/stores/projectOutcomes.svelte';
import type { PatternAnalytics, ProjectOutcome } from '$lib/types/outcome';

/**
 * Stack Advisor Class
 * Provides intelligent stack recommendations based on multiple factors
 */
export class StackAdvisor {
  private weights: ScoringWeights;

  constructor(weights: ScoringWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculate scores for all provided stacks
   */
  async calculateScores(request: CalculateScoresRequest): Promise<StackRecommendationResponse> {
    const weights = request.weights ? { ...DEFAULT_WEIGHTS, ...request.weights } : this.weights;

    // Fetch historical data and user preferences
    const [historicalDataMap, userPreferences] = await Promise.all([
      this.fetchHistoricalData(request.stacks, request.patternId),
      request.userId ? this.fetchUserPreferences(request.userId) : Promise.resolve(undefined),
    ]);

    // Score each stack
    const recommendations = request.stacks.map((stack) => {
      const score = this.calculateStackScore(
        stack,
        request.patternId,
        request.patternName,
        historicalDataMap.get(stack.id),
        userPreferences,
        weights,
        request.projectType
      );

      let explanation: RecommendationExplanation | undefined;
      if (request.includeExplanations) {
        explanation = this.generateExplanation(
          stack,
          score,
          historicalDataMap.get(stack.id),
          request.patternName
        );
      }

      return { stack, score, explanation };
    });

    // Sort by final score descending
    recommendations.sort((a, b) => b.score.finalScore - a.score.finalScore);

    return {
      recommendations,
      historicalData: historicalDataMap,
      userPreferences,
      weightsUsed: weights,
      totalEvaluated: request.stacks.length,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate weighted score for a single stack
   */
  private calculateStackScore(
    stack: TechStack,
    patternId: string,
    patternName: string,
    historicalData: StackHistoricalData | undefined,
    userPreferences: UserPreferences | undefined,
    weights: ScoringWeights,
    projectType?: string
  ): StackScore {
    // Calculate individual component scores
    const profileScore = this.calculateProfileScore(stack, patternId, projectType);
    const languageBonus = this.calculateLanguageBonus(stack, userPreferences);
    const historicalScore = this.calculateHistoricalScore(historicalData);
    const preferenceScore = this.calculatePreferenceScore(stack, userPreferences);
    const projectTypeScore = this.calculateProjectTypeScore(stack, projectType);

    const components: ScoreComponents = {
      profileScore,
      languageBonus,
      historicalScore,
      preferenceScore,
      projectTypeScore,
    };

    // Calculate weighted final score
    const finalScore =
      profileScore * weights.profileMatch +
      languageBonus * weights.languageMatch +
      historicalScore * weights.historicalSuccess +
      preferenceScore * weights.userPreference +
      projectTypeScore * weights.projectTypeMatch;

    // Determine confidence level
    const { confidence, confidenceReasons } = this.calculateConfidence(
      finalScore,
      components,
      historicalData
    );

    return {
      stackId: stack.id,
      finalScore: Math.round(finalScore * 100) / 100,
      components,
      confidence,
      confidenceReasons,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate base profile match score (0-100)
   * Based on stack suitability for the selected pattern
   */
  private calculateProfileScore(
    stack: TechStack,
    patternId: string,
    projectType?: string
  ): number {
    let score = 50; // Base score

    // Pattern-specific bonuses
    const patternBonuses: Record<string, Partial<Record<string, number>>> = {
      'fullstack-web': {
        'next-postgres-prisma': 20,
        'sveltekit-supabase': 20,
        'astro-cloudflare': 15,
        'vite-express-mongo': 15,
      },
      'rest-api-backend': {
        'fastapi-postgres': 20,
        'express-mongo': 20,
        'nestjs-postgres': 15,
      },
      spa: {
        'vite-react': 20,
        'vite-vue': 20,
        'sveltekit-static': 15,
      },
      'static-site': {
        'astro-cloudflare': 25,
        'next-static': 20,
        'sveltekit-static': 20,
      },
      microservices: {
        'docker-compose-multi': 25,
        'kubernetes-multi': 20,
      },
      'desktop-app': {
        'tauri-svelte': 25,
        'electron-react': 20,
      },
    };

    const bonus = patternBonuses[patternId]?.[stack.id] || 0;
    score += bonus;

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Calculate language match bonus (0-100)
   * Based on user's preferred languages
   */
  private calculateLanguageBonus(
    stack: TechStack,
    userPreferences?: UserPreferences
  ): number {
    if (!userPreferences || userPreferences.preferredLanguages.length === 0) {
      return 50; // Neutral score if no preferences
    }

    // Extract languages from stack
    const stackLanguages = this.extractStackLanguages(stack);

    // Calculate overlap with user preferences
    let matchScore = 0;
    let totalWeight = 0;

    userPreferences.preferredLanguages.forEach((pref, index) => {
      const weight = 1 / (index + 1); // Diminishing weight for lower-ranked preferences
      totalWeight += weight;

      if (stackLanguages.includes(pref.language.toLowerCase())) {
        matchScore += weight * pref.averageSatisfaction * 20; // Scale up
      }
    });

    return totalWeight > 0 ? Math.min(matchScore / totalWeight, 100) : 50;
  }

  /**
   * Calculate historical success score (0-100)
   * Based on past project outcomes with this stack
   */
  private calculateHistoricalScore(historicalData: StackHistoricalData | undefined): number {
    if (!historicalData || historicalData.totalProjects === 0) {
      return 50; // Neutral score if no data
    }

    const { totalProjects, successfulBuilds, avgSatisfaction, avgTestPassRate, npsScore } =
      historicalData;

    // Build success rate (0-100)
    const buildSuccessRate = (successfulBuilds / totalProjects) * 100;

    // Satisfaction score (1-5 → 0-100)
    const satisfactionScore = ((avgSatisfaction - 1) / 4) * 100;

    // Test pass rate (already 0-100)
    const testScore = avgTestPassRate;

    // NPS contribution (1-10 → 0-100)
    const npsContribution = npsScore > 0 ? ((npsScore - 1) / 9) * 100 : 50;

    // Weighted average
    const historicalScore =
      buildSuccessRate * 0.4 +
      satisfactionScore * 0.3 +
      testScore * 0.2 +
      npsContribution * 0.1;

    // Apply confidence penalty for low sample sizes
    const sampleSizePenalty = Math.min(totalProjects / 10, 1); // Full confidence at 10+ projects

    return historicalScore * sampleSizePenalty;
  }

  /**
   * Calculate user preference score (0-100)
   * Based on past pattern and framework choices
   */
  private calculatePreferenceScore(
    stack: TechStack,
    userPreferences?: UserPreferences
  ): number {
    if (!userPreferences) {
      return 50; // Neutral score
    }

    let score = 50;

    // Check framework preferences
    const stackFrameworks = this.extractStackFrameworks(stack);
    userPreferences.preferredFrameworks.forEach((pref) => {
      if (stackFrameworks.includes(pref.framework.toLowerCase())) {
        score += (pref.averageSatisfaction - 3) * 10; // -20 to +20 based on satisfaction
      }
    });

    // Complexity match
    if (stack.complexity === userPreferences.complexityPreference) {
      score += 10;
    }

    return Math.max(0, Math.min(score, 100));
  }

  /**
   * Calculate project type match score (0-100)
   * Based on stack suitability for specific project types
   */
  private calculateProjectTypeScore(stack: TechStack, projectType?: string): number {
    if (!projectType) {
      return 50; // Neutral if no project type specified
    }

    // Project type suitability mapping
    const suitability: Record<string, string[]> = {
      ecommerce: ['next-postgres-prisma', 'sveltekit-supabase', 'vite-express-mongo'],
      blog: ['astro-cloudflare', 'next-static', 'sveltekit-static'],
      dashboard: ['vite-react', 'next-postgres-prisma', 'sveltekit-supabase'],
      api: ['fastapi-postgres', 'express-mongo', 'nestjs-postgres'],
      'real-time': ['next-postgres-prisma', 'sveltekit-supabase', 'express-mongo'],
    };

    const suitable = suitability[projectType.toLowerCase()] || [];
    return suitable.includes(stack.id) ? 80 : 40;
  }

  /**
   * Calculate confidence level and reasons
   */
  private calculateConfidence(
    finalScore: number,
    components: ScoreComponents,
    historicalData: StackHistoricalData | undefined
  ): { confidence: ConfidenceLevel; confidenceReasons: string[] } {
    const reasons: string[] = [];
    let confidenceScore = 0;

    // High final score → high confidence
    if (finalScore >= 70) {
      confidenceScore += 3;
      reasons.push('Strong overall match');
    } else if (finalScore >= 50) {
      confidenceScore += 2;
      reasons.push('Good overall match');
    } else {
      confidenceScore += 1;
      reasons.push('Moderate overall match');
    }

    // Historical data availability
    if (historicalData && historicalData.totalProjects >= 10) {
      confidenceScore += 2;
      reasons.push(`Backed by ${historicalData.totalProjects} successful projects`);
    } else if (historicalData && historicalData.totalProjects >= 3) {
      confidenceScore += 1;
      reasons.push(`Some historical data available (${historicalData.totalProjects} projects)`);
    } else {
      reasons.push('Limited historical data');
    }

    // Component consistency
    const componentValues = Object.values(components);
    const avgComponent = componentValues.reduce((a, b) => a + b, 0) / componentValues.length;
    const variance =
      componentValues.reduce((sum, val) => sum + Math.pow(val - avgComponent, 2), 0) /
      componentValues.length;

    if (variance < 100) {
      // Low variance
      confidenceScore += 1;
      reasons.push('Consistent across all factors');
    }

    // Determine confidence level
    let confidence: ConfidenceLevel;
    if (confidenceScore >= 5) {
      confidence = 'high';
    } else if (confidenceScore >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return { confidence, confidenceReasons: reasons };
  }

  /**
   * Generate explanation for a recommendation
   */
  private generateExplanation(
    stack: TechStack,
    score: StackScore,
    historicalData: StackHistoricalData | undefined,
    patternName: string
  ): RecommendationExplanation {
    const factors: ExplanationFactor[] = [];
    const pros: string[] = [];
    const cons: string[] = [];

    // Profile match factor
    if (score.components.profileScore >= 70) {
      factors.push({
        id: 'profile-match',
        label: 'Excellent Pattern Fit',
        description: `This stack is highly optimized for ${patternName} projects`,
        impact: 'high',
        sentiment: 'positive',
        scoreContribution: score.components.profileScore * this.weights.profileMatch,
      });
      pros.push(`Designed specifically for ${patternName} architecture`);
    }

    // Historical success factor
    if (historicalData && historicalData.totalProjects > 0) {
      const successRate = (historicalData.successfulBuilds / historicalData.totalProjects) * 100;
      if (successRate >= 80) {
        factors.push({
          id: 'historical-success',
          label: 'Proven Track Record',
          description: `${successRate.toFixed(0)}% success rate across ${historicalData.totalProjects} projects`,
          impact: 'high',
          sentiment: 'positive',
          scoreContribution: score.components.historicalScore * this.weights.historicalSuccess,
        });
        pros.push(`${successRate.toFixed(0)}% build success rate`);
      }

      if (historicalData.avgSatisfaction >= 4.0) {
        pros.push(
          `High user satisfaction (${historicalData.avgSatisfaction.toFixed(1)}/5.0 stars)`
        );
      }
    } else {
      factors.push({
        id: 'no-history',
        label: 'New Stack',
        description: 'No historical data available yet',
        impact: 'medium',
        sentiment: 'neutral',
        scoreContribution: 0,
      });
      cons.push('Limited historical feedback');
    }

    // Language match factor
    if (score.components.languageBonus >= 70) {
      factors.push({
        id: 'language-match',
        label: 'Familiar Technologies',
        description: "Uses languages you've worked with before",
        impact: 'medium',
        sentiment: 'positive',
        scoreContribution: score.components.languageBonus * this.weights.languageMatch,
      });
      pros.push('Uses your preferred programming languages');
    }

    // Stack-specific pros/cons from historical data
    if (historicalData) {
      pros.push(...historicalData.commonPros.slice(0, 3));
      cons.push(...historicalData.commonCons.slice(0, 2));
    }

    // Generic stack pros
    if (stack.complexity && stack.complexity === 'beginner') {
      pros.push('Quick setup and easy to learn');
    }
    if (stack.features?.includes('TypeScript')) {
      pros.push('Type-safe development experience');
    }

    // Primary reason
    const primaryReason =
      score.finalScore >= 70
        ? `Excellent match for ${patternName} with proven success`
        : score.finalScore >= 50
          ? `Good fit for ${patternName} projects`
          : `Viable option for ${patternName}, but consider alternatives`;

    return {
      stackId: stack.id,
      primaryReason,
      factors,
      pros: pros.slice(0, 5), // Top 5 pros
      cons: cons.slice(0, 3), // Top 3 cons
      successStories: historicalData
        ? [
            {
              patternName,
              successRate:
                (historicalData.successfulBuilds / historicalData.totalProjects) * 100,
              projectCount: historicalData.totalProjects,
            },
          ]
        : undefined,
    };
  }

  /**
   * Fetch historical data for all stacks
   */
  private async fetchHistoricalData(
    stacks: TechStack[],
    patternId: string
  ): Promise<Map<string, StackHistoricalData>> {
    const dataMap = new Map<string, StackHistoricalData>();

    // Fetch analytics from projectOutcomesStore
    await projectOutcomesStore.fetchAnalytics();
    const analytics = projectOutcomesStore.analytics;

    // For each stack, aggregate historical data
    for (const stack of stacks) {
      const historicalData = this.aggregateHistoricalData(stack, patternId, analytics);
      if (historicalData) {
        dataMap.set(stack.id, historicalData);
      }
    }

    return dataMap;
  }

  /**
   * Aggregate historical data for a specific stack
   */
  private aggregateHistoricalData(
    stack: TechStack,
    patternId: string,
    analytics: PatternAnalytics[]
  ): StackHistoricalData | null {
    // Find analytics for this pattern
    const patternAnalytics = analytics.find((a) => a.patternId === patternId);

    if (!patternAnalytics || !patternAnalytics.totalUses) {
      return null;
    }

    // TODO: In a real implementation, we'd filter by stack ID
    // For now, we use pattern-level analytics as a proxy

    const successRate =
      (patternAnalytics.successfulProjects || 0) / (patternAnalytics.totalUses || 1);

    return {
      stackId: stack.id,
      patternId,
      totalProjects: patternAnalytics.totalUses || 0,
      successfulBuilds: patternAnalytics.successfulProjects || 0,
      avgTestPassRate: patternAnalytics.averageTestPassRate || 0,
      avgSatisfaction: patternAnalytics.averageSatisfaction ?? 0,
      npsScore: 0, // TODO: Calculate from feedback
      deployedProjects: 0, // TODO: Calculate from outcomes
      avgTimeToFirstBuild: null,
      commonPros: [], // TODO: Extract from feedback
      commonCons: [], // TODO: Extract from feedback
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Fetch user preferences based on past project outcomes
   */
  private async fetchUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    // Fetch user's past projects
    await projectOutcomesStore.fetchOutcomes(1); // TODO: Filter by userId
    const outcomes = projectOutcomesStore.outcomes;

    if (outcomes.length === 0) {
      return undefined;
    }

    // Aggregate language preferences
    const languageMap = new Map<
      string,
      { usageCount: number; totalSatisfaction: number; feedbackCount: number }
    >();

    outcomes.forEach((outcome) => {
      outcome.languagesUsed.forEach((lang) => {
        const current = languageMap.get(lang) || {
          usageCount: 0,
          totalSatisfaction: 0,
          feedbackCount: 0,
        };
        current.usageCount++;
        languageMap.set(lang, current);
      });
    });

    // TODO: Match with feedback to get satisfaction scores

    const preferredLanguages = Array.from(languageMap.entries())
      .map(([language, data]) => ({
        language,
        usageCount: data.usageCount,
        averageSatisfaction: data.feedbackCount > 0 ? data.totalSatisfaction / data.feedbackCount : 3.5,
      }))
      .sort((a, b) => b.usageCount - a.usageCount);

    // Aggregate pattern preferences
    const patternMap = new Map<string, { usageCount: number; avgSatisfaction: number }>();
    outcomes.forEach((outcome) => {
      const current = patternMap.get(outcome.patternId) || { usageCount: 0, avgSatisfaction: 3.5 };
      current.usageCount++;
      patternMap.set(outcome.patternId, current);
    });

    const preferredPatterns = Array.from(patternMap.entries())
      .map(([patternId, data]) => ({
        patternId,
        patternName: outcomes.find((o) => o.patternId === patternId)?.patternName || patternId,
        usageCount: data.usageCount,
        averageSatisfaction: data.avgSatisfaction,
      }))
      .sort((a, b) => b.usageCount - a.usageCount);

    return {
      userId,
      preferredLanguages,
      preferredPatterns,
      preferredFrameworks: [], // TODO: Extract from outcomes
      complexityPreference: 'unknown',
      deploymentPreference: 'unknown',
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Extract languages from stack
   */
  private extractStackLanguages(stack: TechStack): string[] {
    const languages: string[] = [];

    // Parse from stack name and features
    if (stack.name.toLowerCase().includes('typescript')) languages.push('typescript');
    if (stack.name.toLowerCase().includes('python')) languages.push('python');
    if (stack.name.toLowerCase().includes('go')) languages.push('go');
    if (stack.name.toLowerCase().includes('rust')) languages.push('rust');
    if (stack.name.toLowerCase().includes('java')) languages.push('java');

    // TODO: Add more sophisticated language detection

    return languages;
  }

  /**
   * Extract frameworks from stack
   */
  private extractStackFrameworks(stack: TechStack): string[] {
    const frameworks: string[] = [];

    // Parse from stack name
    if (stack.name.toLowerCase().includes('react')) frameworks.push('react');
    if (stack.name.toLowerCase().includes('next')) frameworks.push('nextjs');
    if (stack.name.toLowerCase().includes('svelte')) frameworks.push('svelte');
    if (stack.name.toLowerCase().includes('vue')) frameworks.push('vue');
    if (stack.name.toLowerCase().includes('fastapi')) frameworks.push('fastapi');
    if (stack.name.toLowerCase().includes('express')) frameworks.push('express');

    return frameworks;
  }
}

/**
 * Singleton instance for global use
 */
export const stackAdvisor = new StackAdvisor();
