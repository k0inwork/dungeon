import { test, expect } from '@playwright/test';

test('Comprehensive Game Walkthrough v3', async ({ page }) => {
    test.setTimeout(120000);

    console.log('Navigating to game...');
    await page.goto('http://localhost:3000');

    // Step 1: Boot Screen
    const startButton = page.locator('button:has-text("INITIATE GENERATION")');
    await expect(startButton).toBeVisible({ timeout: 20000 });

    console.log('Shift-clicking Initiate Generation for mock world...');
    await startButton.click({ modifiers: ['Shift'] });

    // Step 2: Wait for Simulation to be ready
    console.log('Waiting for Hub to load...');
    await expect(page.locator('text=Simulation Ready.')).toBeVisible({ timeout: 40000 });

    // Check HP
    const hpHud = page.locator('text=HP: 100/100').first();
    await expect(hpHud).toBeVisible({ timeout: 5000 });
    console.log('HP Verified: 100/100');

    // Step 3: Move to the Portal [P] at 11,3
    // We'll move more carefully.
    // 1,1 -> 11,1 (10 steps Right)
    // 11,1 -> 11,3 (2 steps Down)
    console.log('Moving Right 10 steps...');
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
    }
    console.log('Moving Down 2 steps...');
    for (let i = 0; i < 2; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
    }

    // Step 4: Check for Transition log
    console.log('Waiting for Transition log...');
    // The log should say "Transitioning to Upper Platformer..."
    const transitionLog = page.locator('text=Transitioning to Upper Platformer');
    await expect(transitionLog).toBeVisible({ timeout: 20000 });
    console.log('Transition Log found!');

    // Step 5: Wait for Platformer simulation to start
    await page.waitForTimeout(2000);
    console.log('Checking for Platformer Simulation...');
    // In Platformer, the status bar changes to PLATFORM
    await expect(page.locator('text=STATUS: PLATFORM')).toBeVisible({ timeout: 10000 });
    console.log('Mode is PLATFORM.');

    await page.screenshot({ path: 'walkthrough_v3_platformer.png' });

    // Step 6: Verify no immediate death in Platformer
    await page.waitForTimeout(2000);
    const gameOver = await page.locator('text=YOU DIED').isVisible();
    expect(gameOver).toBe(false);
    console.log('Still alive in Platformer.');

    await page.screenshot({ path: 'walkthrough_v3_success.png' });
});
