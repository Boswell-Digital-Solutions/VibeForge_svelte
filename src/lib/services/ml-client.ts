/**
 * ML API Client - Phase 4.2.4
 * Client for ML-based project success prediction and risk assessment.
 */

import type {
  MLPredictionRequest,
  MLPredictionResponse,
  RiskAssessmentResponse,
  FeatureImportanceResponse,
  TrainingStatusResponse,
  ModelStatus,
} from '$lib/types/ml';
import { NEUROFORGE_URL } from '$lib/core/api/endpoints';

const API_BASE_URL = NEUROFORGE_URL;
const ML_API_PREFIX = '/api/v1/ml';

/**
 * Predict project success probability
 */
export async function predictProjectSuccess(
  request: MLPredictionRequest
): Promise<MLPredictionResponse> {
  const response = await fetch(`${API_BASE_URL}${ML_API_PREFIX}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to predict project success');
  }

  return response.json();
}

/**
 * Assess project risks and get recommendations
 */
export async function assessProjectRisk(
  request: MLPredictionRequest
): Promise<RiskAssessmentResponse> {
  const response = await fetch(`${API_BASE_URL}${ML_API_PREFIX}/assess-risk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to assess project risk');
  }

  return response.json();
}

/**
 * Get feature importance from trained model
 */
export async function getFeatureImportance(): Promise<FeatureImportanceResponse> {
  const response = await fetch(`${API_BASE_URL}${ML_API_PREFIX}/feature-importance`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to get feature importance');
  }

  return response.json();
}

/**
 * Get ML model status
 */
export async function getModelStatus(): Promise<ModelStatus> {
  const response = await fetch(`${API_BASE_URL}${ML_API_PREFIX}/model-status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to get model status');
  }

  return response.json();
}

/**
 * Train ML model (admin only)
 */
export async function trainModel(
  minDate?: string,
  maxDate?: string,
  autoDeploy: boolean = true
): Promise<TrainingStatusResponse> {
  const response = await fetch(`${API_BASE_URL}${ML_API_PREFIX}/train`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      min_date: minDate,
      max_date: maxDate,
      auto_deploy: autoDeploy,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to train model');
  }

  return response.json();
}

/**
 * Trigger model retraining if needed (admin only)
 */
export async function retrainIfNeeded(): Promise<{
  action: 'none' | 'retrained' | 'failed';
  message: string;
  sample_count?: number;
  duration_seconds?: number;
}> {
  const response = await fetch(`${API_BASE_URL}${ML_API_PREFIX}/retrain-if-needed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || 'Failed to check model retraining');
  }

  return response.json();
}
