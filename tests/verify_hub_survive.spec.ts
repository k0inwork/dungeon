import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test('Verify Hub movement and survival', async ({ page }) => {
    // Increase timeout for slow CI environments
    test.setTimeout(120000);

    // 1. Load the game
    await page.goto('http://localhost:3000');

    // Wait for the "INITIATE GENERATION" button and click it
    const startButton = page.locator('button:has-text("INITIATE GENERATION")');
    await expect(startButton).toBeVisible({ timeout: 15000 });
    await startButton.click();

    // 2. Wait for the game world to load
    // The "Log Window" should be visible
    await expect(page.locator('text=Log Window')).toBeVisible({ timeout: 20000 });

    console.log('Game loaded. Initial state:');

    // 3. Move the player and check for survival
    // We'll move several times to ensure stability
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(300);

        // Check if "YOU DIED" overlay appeared
        const gameOver = await page.locator('text=YOU DIED').isVisible();
        if (gameOver) {
            console.error('FAIL: Player died unexpectedly in Hub!');
            const logs = await page.locator('.log-message').allTextContents();
            console.log('Recent logs:', logs.slice(-10));

            // Take a screenshot of the failure
            await page.screenshot({ path: 'hub_failure.png' });
            throw new Error('Player died in Hub');
        }
    }

    console.log('Player moved 10 steps in Hub and survived.');

    // 4. Inspect the logs for suppression messages
    const logs = await page.locator('.log-message').allTextContents();
    const suppressionLogs = logs.filter(l => l.includes('Suppressed BOGUS Game Over'));
    if (suppressionLogs.length > 0) {
        console.log(`Detected ${suppressionLogs.length} suppressed bogus death events. This indicates the fix is working.`);
    }

    await page.screenshot({ path: 'hub_success.png' });
});
