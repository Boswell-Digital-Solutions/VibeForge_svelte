<!--
  FeedbackModal.svelte

  Post-scaffolding feedback collection modal
  Phase 3.4: Outcome Tracking & Feedback Loop
-->
<script lang="ts">
  import { projectOutcomesStore } from '$lib/stores/projectOutcomes.svelte';
  import { POSITIVE_ASPECTS, NEGATIVE_ASPECTS } from '$lib/types/outcome';
  import type { FeedbackFormData } from '$lib/types/outcome';

  // Props
  interface Props {
    projectOutcomeId: string;
    projectName: string;
    patternName: string;
    onClose?: () => void;
  }

  let { projectOutcomeId, projectName, patternName, onClose }: Props = $props();

  // Form state
  let formData = $state<FeedbackFormData>({
    overallSatisfaction: 5,
    patternUsefulness: 5,
    codeQuality: 5,
    documentationClarity: 5,
    setupEase: 5,
    positiveAspects: [],
    negativeAspects: [],
    additionalComments: '',
    wouldRecommend: null,
    likelihoodToReuse: 8,
    featureRequests: [],
  });

  let currentStep = $state<'rating' | 'details' | 'thanks'>('rating');
  let featureRequestInput = $state('');

  // Computed
  let canSubmit = $derived(
    currentStep === 'rating' ? formData.overallSatisfaction >= 1 : true
  );

  let isSubmitting = $derived(projectOutcomesStore.isSubmittingFeedback);

  // Methods
  function handleNext() {
    if (currentStep === 'rating') {
      currentStep = 'details';
    }
  }

  function handleBack() {
    if (currentStep === 'details') {
      currentStep = 'rating';
    }
  }

  async function handleSubmit() {
    const success = await projectOutcomesStore.submitFeedback({
      projectOutcomeId,
      ...formData,
      // The form uses null for "unanswered"; the request omits the field instead.
      wouldRecommend: formData.wouldRecommend ?? undefined,
    });

    if (success) {
      currentStep = 'thanks';
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  }

  function handleClose() {
    projectOutcomesStore.dismissFeedback();
    if (onClose) onClose();
  }

  function togglePositiveAspect(value: string) {
    if (formData.positiveAspects.includes(value)) {
      formData.positiveAspects = formData.positiveAspects.filter((a) => a !== value);
    } else {
      formData.positiveAspects = [...formData.positiveAspects, value];
    }
  }

  function toggleNegativeAspect(value: string) {
    if (formData.negativeAspects.includes(value)) {
      formData.negativeAspects = formData.negativeAspects.filter((a) => a !== value);
    } else {
      formData.negativeAspects = [...formData.negativeAspects, value];
    }
  }

  function addFeatureRequest() {
    if (featureRequestInput.trim()) {
      formData.featureRequests = [...formData.featureRequests, featureRequestInput.trim()];
      featureRequestInput = '';
    }
  }

  function removeFeatureRequest(index: number) {
    formData.featureRequests = formData.featureRequests.filter((_, i) => i !== index);
  }
</script>

<!-- Modal Overlay -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  onclick={handleClose}
  role="dialog"
  aria-modal="true"
  aria-labelledby="feedback-modal-title"
>
  <!-- Modal Content -->
  <div
    class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gunmetal-900 rounded-xl shadow-2xl border border-gunmetal-700"
    onclick={(e) => e.stopPropagation()}
    role="document"
  >
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-gunmetal-900 border-b border-gunmetal-700 px-6 py-4">
      <div class="flex items-start justify-between">
        <div>
          <h2 id="feedback-modal-title" class="text-2xl font-semibold text-zinc-100">
            {#if currentStep === 'thanks'}
              Thank You! 🎉
            {:else}
              How was your experience?
            {/if}
          </h2>
          <p class="text-sm text-zinc-400 mt-1">
            {projectName} · {patternName}
          </p>
        </div>

        <!-- Close Button -->
        <button
          type="button"
          class="text-zinc-400 hover:text-zinc-100 transition-colors"
          onclick={handleClose}
          aria-label="Close feedback modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Progress Indicator -->
      {#if currentStep !== 'thanks'}
        <div class="flex items-center gap-2 mt-4">
          <div
            class="flex-1 h-1 rounded-full {currentStep === 'rating'
              ? 'bg-ember-500'
              : 'bg-gunmetal-700'}"
          ></div>
          <div
            class="flex-1 h-1 rounded-full {currentStep === 'details'
              ? 'bg-ember-500'
              : 'bg-gunmetal-700'}"
          ></div>
        </div>
      {/if}
    </div>

    <!-- Body -->
    <div class="px-6 py-6">
      {#if currentStep === 'rating'}
        <!-- Step 1: Core Ratings -->
        <div class="space-y-6">
          <!-- Overall Satisfaction -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              Overall Satisfaction <span class="text-red-400">*</span>
            </label>
            <div class="flex items-center gap-2">
              {#each [1, 2, 3, 4, 5] as rating}
                <button
                  type="button"
                  class="star-button {formData.overallSatisfaction >= rating ? 'active' : ''}"
                  onclick={() => (formData.overallSatisfaction = rating)}
                  aria-label="{rating} stars"
                >
                  <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    />
                  </svg>
                </button>
              {/each}
              <span class="ml-2 text-zinc-400 text-sm">
                ({formData.overallSatisfaction}/5)
              </span>
            </div>
          </div>

          <!-- Pattern Usefulness -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              Pattern Usefulness
            </label>
            <input
              type="range"
              min="1"
              max="5"
              bind:value={formData.patternUsefulness}
              class="slider w-full"
            />
            <div class="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Not Useful</span>
              <span>Very Useful ({formData.patternUsefulness}/5)</span>
            </div>
          </div>

          <!-- Code Quality -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">Code Quality</label>
            <input
              type="range"
              min="1"
              max="5"
              bind:value={formData.codeQuality}
              class="slider w-full"
            />
            <div class="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Poor</span>
              <span>Excellent ({formData.codeQuality}/5)</span>
            </div>
          </div>

          <!-- Documentation Clarity -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              Documentation Clarity
            </label>
            <input
              type="range"
              min="1"
              max="5"
              bind:value={formData.documentationClarity}
              class="slider w-full"
            />
            <div class="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Unclear</span>
              <span>Very Clear ({formData.documentationClarity}/5)</span>
            </div>
          </div>

          <!-- Setup Ease -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">Setup Ease</label>
            <input
              type="range"
              min="1"
              max="5"
              bind:value={formData.setupEase}
              class="slider w-full"
            />
            <div class="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Difficult</span>
              <span>Very Easy ({formData.setupEase}/5)</span>
            </div>
          </div>

          <!-- Would Recommend -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              Would you recommend this pattern to others?
            </label>
            <div class="flex gap-3">
              <button
                type="button"
                class="recommend-button {formData.wouldRecommend === true ? 'active yes' : ''}"
                onclick={() => (formData.wouldRecommend = true)}
              >
                👍 Yes
              </button>
              <button
                type="button"
                class="recommend-button {formData.wouldRecommend === false ? 'active no' : ''}"
                onclick={() => (formData.wouldRecommend = false)}
              >
                👎 No
              </button>
            </div>
          </div>
        </div>
      {:else if currentStep === 'details'}
        <!-- Step 2: Detailed Feedback -->
        <div class="space-y-6">
          <!-- Positive Aspects -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              What did you like? (Select all that apply)
            </label>
            <div class="flex flex-wrap gap-2">
              {#each POSITIVE_ASPECTS as aspect}
                <button
                  type="button"
                  class="aspect-chip {formData.positiveAspects.includes(aspect.value)
                    ? 'active positive'
                    : ''}"
                  onclick={() => togglePositiveAspect(aspect.value)}
                >
                  {aspect.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Negative Aspects -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              What could be improved? (Select all that apply)
            </label>
            <div class="flex flex-wrap gap-2">
              {#each NEGATIVE_ASPECTS as aspect}
                <button
                  type="button"
                  class="aspect-chip {formData.negativeAspects.includes(aspect.value)
                    ? 'active negative'
                    : ''}"
                  onclick={() => toggleNegativeAspect(aspect.value)}
                >
                  {aspect.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Likelihood to Reuse (NPS) -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              How likely are you to use this pattern again? (1-10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              bind:value={formData.likelihoodToReuse}
              class="slider w-full"
            />
            <div class="flex justify-between text-xs text-zinc-500 mt-1">
              <span>Not at all</span>
              <span>Very likely ({formData.likelihoodToReuse}/10)</span>
            </div>
          </div>

          <!-- Feature Requests -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              Feature Requests (Optional)
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                bind:value={featureRequestInput}
                placeholder="e.g., Add Docker support, Better error messages"
                class="flex-1 px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-ember-500"
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeatureRequest();
                  }
                }}
              />
              <button
                type="button"
                class="px-4 py-2 bg-ember-500 text-white rounded-md hover:bg-ember-600 transition-colors"
                onclick={addFeatureRequest}
              >
                Add
              </button>
            </div>
            {#if formData.featureRequests.length > 0}
              <ul class="mt-2 space-y-1">
                {#each formData.featureRequests as request, index}
                  <li class="flex items-center justify-between px-3 py-2 bg-gunmetal-800 rounded-md text-sm text-zinc-300">
                    <span>{request}</span>
                    <button
                      type="button"
                      class="text-red-400 hover:text-red-300"
                      onclick={() => removeFeatureRequest(index)}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>

          <!-- Additional Comments -->
          <div>
            <label class="block text-sm font-medium text-zinc-200 mb-2">
              Additional Comments (Optional)
            </label>
            <textarea
              bind:value={formData.additionalComments}
              rows="4"
              placeholder="Any other feedback or suggestions..."
              class="w-full px-3 py-2 bg-gunmetal-800 border border-gunmetal-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-ember-500 resize-none"
            ></textarea>
          </div>
        </div>
      {:else if currentStep === 'thanks'}
        <!-- Step 3: Thank You -->
        <div class="text-center py-8">
          <div class="text-6xl mb-4">🎉</div>
          <h3 class="text-2xl font-semibold text-zinc-100 mb-2">Thank You!</h3>
          <p class="text-zinc-400">
            Your feedback helps us improve VibeForge for everyone.
          </p>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    {#if currentStep !== 'thanks'}
      <div
        class="sticky bottom-0 bg-gunmetal-900 border-t border-gunmetal-700 px-6 py-4 flex items-center justify-between"
      >
        <div class="text-xs text-zinc-500">
          {currentStep === 'rating' ? 'Step 1 of 2' : 'Step 2 of 2'}
        </div>

        <div class="flex gap-3">
          {#if currentStep === 'details'}
            <button
              type="button"
              class="px-4 py-2 bg-gunmetal-700 text-zinc-200 rounded-md hover:bg-gunmetal-600 transition-colors"
              onclick={handleBack}
            >
              Back
            </button>
          {/if}

          {#if currentStep === 'rating'}
            <button
              type="button"
              class="px-6 py-2 bg-ember-500 text-white rounded-md hover:bg-ember-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onclick={handleNext}
              disabled={!canSubmit}
            >
              Next
            </button>
          {:else}
            <button
              type="button"
              class="px-6 py-2 bg-ember-500 text-white rounded-md hover:bg-ember-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onclick={handleSubmit}
              disabled={isSubmitting}
            >
              {#if isSubmitting}
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              {:else}
                Submit Feedback
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Star Rating Buttons */
  .star-button {
    color: #52525b; /* zinc-600 */
    transition: all 0.2s;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .star-button:hover {
    color: #fbbf24; /* amber-400 */
    transform: scale(1.1);
  }

  .star-button.active {
    color: #fbbf24; /* amber-400 */
  }

  /* Range Sliders */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    height: 6px;
    border-radius: 3px;
    background: #3f3f46; /* zinc-700 */
    outline: none;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #f97316; /* ember-500 */
    cursor: pointer;
    transition: all 0.2s;
  }

  .slider::-webkit-slider-thumb:hover {
    background: #ea580c; /* ember-600 */
    transform: scale(1.1);
  }

  .slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #f97316;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .slider::-moz-range-thumb:hover {
    background: #ea580c;
    transform: scale(1.1);
  }

  /* Recommend Buttons */
  .recommend-button {
    flex: 1;
    padding: 12px;
    border: 2px solid #52525b; /* zinc-600 */
    background: transparent;
    color: #a1a1aa; /* zinc-400 */
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .recommend-button:hover {
    border-color: #71717a; /* zinc-500 */
    color: #d4d4d8; /* zinc-300 */
  }

  .recommend-button.active.yes {
    border-color: #22c55e; /* green-500 */
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .recommend-button.active.no {
    border-color: #ef4444; /* red-500 */
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  /* Aspect Chips */
  .aspect-chip {
    padding: 8px 16px;
    border: 2px solid #52525b;
    background: transparent;
    color: #a1a1aa;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .aspect-chip:hover {
    border-color: #71717a;
    color: #d4d4d8;
  }

  .aspect-chip.active.positive {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .aspect-chip.active.negative {
    border-color: #f97316;
    background: rgba(249, 115, 22, 0.1);
    color: #f97316;
  }
</style>
