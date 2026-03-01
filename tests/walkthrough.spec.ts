import { test, expect } from '@playwright/test';

test('Comprehensive Game Walkthrough', async ({ page }) => {
    test.setTimeout(120000);

    console.log('Navigating to game...');
    await page.goto('http://localhost:3000');

    // Step 1: Boot Screen
    const startButton = page.locator('button:has-text("INITIATE GENERATION")');
    await expect(startButton).toBeVisible({ timeout: 20000 });

    console.log('Shift-clicking Initiate Generation for mock world...');
    // Shift-click to use mock world immediately
    await startButton.click({ modifiers: ['Shift'] });

    // Step 2: Wait for Simulation to be ready
    console.log('Waiting for Hub to load...');
    // In Mock Hub, the player is at 1,1. The Portal [P] is at 10,3.
    // We wait for the "TIP:" text in the LogWindow, which only appears when PresentationLayer is rendered.
    await expect(page.locator('text=TIP: Use [1-4]')).toBeVisible({ timeout: 40000 });
    console.log('Game loaded into Hub.');
    await page.screenshot({ path: 'walkthrough_hub.png' });

    // Step 3: Verify Hub survival and movement
    // The player starts at 1,1.
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
    }

    const gameOver = await page.locator('text=YOU DIED').isVisible();
    if (gameOver) {
        await page.screenshot({ path: 'walkthrough_died_hub.png' });
        throw new Error('Player died in Hub');
    }
    console.log('Survived Hub movement.');

    // Step 4: Move to the Portal [P] at 10,3
    // Start 1,1. Right 9 -> 10,1. Down 2 -> 10,3.
    console.log('Moving to Platformer portal...');
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); }
    for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100); }

    // Step 5: Wait for Platformer transition
    console.log('Waiting for Platformer transition...');
    // Platformer 1 should have "Upper Platformer" in the theme/log or just check for the platformer view
    // We can check if the mode changed by looking for the canvas or specific text
    // The LogWindow shows "Transitioning to Upper Platformer..."
    await expect(page.locator('text=Upper Platformer')).toBeVisible({ timeout: 15000 });
    console.log('Transitioned to Platformer.');
    await page.screenshot({ path: 'walkthrough_platformer.png' });

    // Step 6: Move in Platformer
    // Space triggers Luma Burst (Skill)
    console.log('Testing skill in Platformer...');
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);

    // Check for "Skill: Luma Burst" in logs if we added logging for it

    // Move right in platformer
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
    }

    const gameOver2 = await page.locator('text=YOU DIED').isVisible();
    expect(gameOver2).toBe(false);

    await page.screenshot({ path: 'walkthrough_final.png' });
    console.log('Walkthrough complete.');
});
