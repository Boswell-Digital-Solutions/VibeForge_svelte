import { test, expect } from '@playwright/test';

/**
 * E2E Tests for New Project Wizard Modal
 *
 * Tests the core wizard functionality after workbench architecture refactoring:
 * - Opening wizard via keyboard shortcut (⌘N)
 * - Opening wizard via button click
 * - Opening wizard via command palette
 * - Closing wizard with ESC
 * - Navigating through all 5 steps
 * - Form validation
 * - Draft persistence
 */

test.describe('Wizard Modal - Opening and Closing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should open wizard with Cmd+N keyboard shortcut', { tag: '@smoke' }, async ({ page }) => {
    // Press Cmd+N (or Ctrl+N on non-Mac)
    await page.keyboard.press('Meta+N');

    // Wizard should be visible
    await expect(page.getByRole('heading', { name: 'New Project' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();
  });

  test('should open wizard via New Project button in TopBar', async ({ page }) => {
    // Click the New Project button
    await page.click('button:has-text("New Project")');

    // Wizard should open
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible({ timeout: 5000 });
  });

  test('should open wizard via command palette', async ({ page }) => {
    // Open command palette with Cmd+K
    await page.keyboard.press('Meta+K');

    // Wait for palette to open
    await page.waitForSelector('input[placeholder*="command" i], input[placeholder*="search" i]', { timeout: 5000 });

    // Type "new project"
    await page.keyboard.type('new project');

    // Press Enter to select command
    await page.keyboard.press('Enter');

    // Wizard should open
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible({ timeout: 5000 });
  });

  test('should close wizard with ESC key', { tag: '@smoke' }, async ({ page }) => {
    // Open wizard
    await page.keyboard.press('Meta+N');
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();

    // Press ESC to close
    await page.keyboard.press('Escape');

    // Wizard should close
    await expect(page.getByRole('heading', { name: 'Project Intent' })).not.toBeVisible({ timeout: 3000 });
  });

  test('should close wizard by clicking backdrop', async ({ page }) => {
    // Open wizard
    await page.keyboard.press('Meta+N');
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();

    // Click backdrop (outside modal)
    await page.click('.bg-black\\/50, [role="dialog"] ~ div', { force: true });

    // Wizard should close
    await expect(page.getByRole('heading', { name: 'Project Intent' })).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Wizard Modal - Step Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open wizard
    await page.keyboard.press('Meta+N');
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();
  });

  test('should show all 5 wizard steps', async ({ page }) => {
    const steps = [
      'Project Intent',
      'Languages',
      'Stack',
      'Configuration',
      'Review & Launch'
    ];

    // Check that step 1 is active
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();

    // Verify all steps are shown in progress indicator
    for (const step of steps) {
      await expect(page.locator(`text=${step}`).first()).toBeVisible();
    }
  });

  test('should navigate through all steps with valid data', async ({ page }) => {
    // Step 1: Project Intent
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Test Project');
    await page.fill('textarea[name="projectDescription"], textarea[id="project-description"]', 'A test project for E2E testing');

    // Select project type
    await page.click('button:has-text("Web Application"), [data-testid="project-type-web"]');

    // Click Next or press Cmd+Enter
    await page.click('button:has-text("Next")');

    // Step 2: Languages
    await expect(page.locator('text=Select Languages')).toBeVisible({ timeout: 5000 });

    // Select a primary language
    await page.click('button:has-text("TypeScript"), [data-language="typescript"]');

    await page.click('button:has-text("Next")');

    // Step 3: Stack
    await expect(page.locator('text=Choose Technology Stack')).toBeVisible({ timeout: 5000 });

    // Select a stack
    await page.click('button:has-text("Next.js"), [data-stack*="nextjs"]', { timeout: 5000 });

    await page.click('button:has-text("Next")');

    // Step 4: Configuration
    await expect(page.locator('text=Configure Features')).toBeVisible({ timeout: 5000 });

    // Features can be toggled, but we'll skip for now
    await page.click('button:has-text("Next")');

    // Step 5: Review & Launch
    await expect(page.locator('text=Review')).toBeVisible({ timeout: 5000 });

    // Should show project summary
    await expect(page.locator('text=Test Project')).toBeVisible();
  });

  test('should go back to previous step with Back button', async ({ page }) => {
    // Fill Step 1 and advance
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Test Project');
    await page.click('button:has-text("Next")');

    // Now on Step 2
    await expect(page.locator('text=Select Languages')).toBeVisible();

    // Click Back
    await page.click('button:has-text("Back")');

    // Should be back on Step 1
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();
    await expect(page.locator('input[name="projectName"], input[id="project-name"]')).toHaveValue('Test Project');
  });

  test('should disable Next button when step is invalid', async ({ page }) => {
    // Step 1 without project name should disable Next
    const nextButton = page.locator('button:has-text("Next")');

    // Should be disabled initially (no project name)
    await expect(nextButton).toBeDisabled();

    // Fill project name
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Test');

    // Should be enabled now
    await expect(nextButton).toBeEnabled({ timeout: 3000 });
  });
});

test.describe('Wizard Modal - Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Meta+N');
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();
  });

  test('should validate project name is required', async ({ page }) => {
    // Try to advance without project name
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();

    // Fill with too short name
    await page.fill('input[name="projectName"], input[id="project-name"]', 'ab');

    // Should show validation error or keep Next disabled
    // (depending on implementation)
  });

  test('should validate project name length', async ({ page }) => {
    // Max 50 characters
    const longName = 'a'.repeat(60);
    await page.fill('input[name="projectName"], input[id="project-name"]', longName);

    // Value should be truncated or show error
    const input = page.locator('input[name="projectName"], input[id="project-name"]');
    const value = await input.inputValue();

    expect(value.length).toBeLessThanOrEqual(50);
  });

  test('should require primary language selection', async ({ page }) => {
    // Fill Step 1
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Test Project');
    await page.click('button:has-text("Next")');

    // Step 2: Languages - Next should be disabled without selection
    await expect(page.locator('text=Select Languages')).toBeVisible();

    const nextButton = page.locator('button:has-text("Next")');

    // Should be disabled without language selection
    await expect(nextButton).toBeDisabled({ timeout: 2000 });
  });
});

test.describe('Wizard Modal - Draft Persistence', () => {
  test('should save draft to localStorage on step change', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open wizard and fill some data
    await page.keyboard.press('Meta+N');
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Draft Project');

    // Wait a bit for auto-save
    await page.waitForTimeout(1000);

    // Check localStorage
    const draftData = await page.evaluate(() => {
      const draft = localStorage.getItem('vibeforge:wizard-draft');
      return draft ? JSON.parse(draft) : null;
    });

    expect(draftData).toBeTruthy();
    expect(draftData?.projectName).toBe('Draft Project');
  });

  test('should restore draft when reopening wizard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // First session: Create draft
    await page.keyboard.press('Meta+N');
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Restored Project');
    await page.keyboard.press('Escape');

    // Wait for draft save
    await page.waitForTimeout(1000);

    // Second session: Reopen wizard
    await page.keyboard.press('Meta+N');

    // Should restore draft
    const input = page.locator('input[name="projectName"], input[id="project-name"]');
    await expect(input).toHaveValue('Restored Project', { timeout: 3000 });
  });
});

test.describe('Wizard Modal - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Meta+N');
    await expect(page.getByRole('heading', { name: 'Project Intent' })).toBeVisible();
  });

  test('should advance to next step with Cmd+Enter', async ({ page }) => {
    // Fill Step 1
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Test Project');

    // Press Cmd+Enter to advance
    await page.keyboard.press('Meta+Enter');

    // Should be on Step 2
    await expect(page.locator('text=Select Languages')).toBeVisible({ timeout: 5000 });
  });

  test('should close with ESC at any step', async ({ page }) => {
    // Fill and advance
    await page.fill('input[name="projectName"], input[id="project-name"]', 'Test');
    await page.click('button:has-text("Next")');

    // On Step 2, press ESC
    await page.keyboard.press('Escape');

    // Should close
    await expect(page.locator('text=Select Languages')).not.toBeVisible({ timeout: 3000 });
  });
});
