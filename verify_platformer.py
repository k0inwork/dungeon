
from playwright.sync_api import sync_playwright
import time

def verify_platformer_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:3001")
        page.wait_for_selector("text=WORLD SEED INPUT")
        page.click("text=INITIATE GENERATION", modifiers=["Shift"])

        page.wait_for_selector("text=STATUS: GRID")
        time.sleep(1)

        print("Moving to platformer portal...")
        # @ is at (1, 1). P is at (10, 3).
        for _ in range(12):
            page.keyboard.press("ArrowRight")
            time.sleep(0.1)
        for _ in range(5):
            page.keyboard.press("ArrowDown")
            time.sleep(0.1)

        page.screenshot(path="/app/pre_transition.png")
        time.sleep(1)
        try:
            page.wait_for_selector("text=STATUS: PLATFORM", timeout=5000)
            print("Entered PLATFORM mode.")
        except:
            print("Failed to enter PLATFORM mode.")
            browser.close()
            return

        # 1. Verify Inspection (Click near a frog)
        # In MockWorld, Level 1 (P1) has frogs at (10, 15) etc.
        # Let's just click somewhere where entities usually are.
        # Actually, let's look at MockWorld.ts to be sure.
        # Level 1 has 'f' at (10, 18), (15, 18), (20, 18) etc.
        # Let's click at (10, 18).
        # TerminalCanvas coordinates.

        print("Clicking to inspect frog...")
        # TerminalCanvas has a click handler that takes grid coords.
        # We can simulate this by clicking on the canvas.
        canvas = page.locator("canvas")
        box = canvas.bounding_box()
        # Canvas is 40x20.
        # frog_1 is at (10, 2)
        target_x = box['x'] + (10.5 / 40) * box['width']
        target_y = box['y'] + (2.5 / 20) * box['height']
        page.mouse.click(target_x, target_y)
        time.sleep(0.5)

        if page.locator("text=ENTITY INSPECTOR").is_visible():
            print("Inspection successful!")
        else:
            print("Inspection failed or no entity found at target.")

        # 2. Verify Auto-pickup and Damage
        # Move right to hit loot or frogs.
        print("Moving to test damage and pickup...")
        for _ in range(20):
            page.keyboard.down("ArrowRight")
            time.sleep(0.1)
        page.keyboard.up("ArrowRight")
        time.sleep(1)

        log_text = page.inner_text('div[style*="height: 120px"]')
        if "Ouch! You took damage!" in log_text:
            print("Damage log found!")
        if "Picked up Loot!" in log_text or "Picked up Item ID" in log_text:
            print("Pickup log found!")

        page.screenshot(path="/app/platformer_features_verify.png")
        browser.close()

if __name__ == "__main__":
    verify_platformer_features()
