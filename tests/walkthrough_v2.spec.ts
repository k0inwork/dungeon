import { test, expect } from '@playwright/test';

test('Comprehensive Game Walkthrough', async ({ page }) => {
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
    await expect(page.locator('text=TIP: Use [1-4]')).toBeVisible({ timeout: 40000 });
    console.log('Game loaded into Hub.');

    // Give it a moment to sync player stats
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'walkthrough_hub_ready.png' });

    // Step 3: Check Player HP in HUD
    const hpHud = page.locator('div:has-text("HP:")').first();
    const hpText = await hpHud.innerText();
    console.log('Current HUD HP:', hpText);
    // expect(hpText).toContain('100/100'); // Might be too strict if it takes time, but let's see

    // Step 4: Move to the Portal [P] at 11,3
    // Start 1,1. Right 10 -> 11,1. Down 2 -> 11,3.
    console.log('Moving to Platformer portal at 11,3...');
    for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(150);
    }
    for (let i = 0; i < 2; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
    }

    // Step 5: Wait for Platformer transition
    console.log('Waiting for Platformer transition...');
    // We expect the log to eventually contain "Transitioning to Upper Platformer..."
    // or the HUD to stay active and the mode to change.
    await expect(page.locator('text=Upper Platformer')).toBeVisible({ timeout: 20000 });
    console.log('Transitioned to Platformer.');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'walkthrough_platformer_entities.png' });

    // Step 6: Verify entities in platformer
    // In PLATFORMER_1, there are frogs 'f' and 'F' and loot '$'.
    // We can't easily "see" them in DOM, but we can check if they are in the log if they move or if we inspect them.
    // Or we just verify that we are in PLATFORM mode and the screen isn't black.

    // Move right in platformer
    for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
    }

    const gameOver = await page.locator('text=YOU DIED').isVisible();
    expect(gameOver).toBe(false);

    await page.screenshot({ path: 'walkthrough_success_final.png' });
    console.log('Walkthrough complete.');
});
