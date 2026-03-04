import time
import re
from collections import defaultdict
from playwright.sync_api import sync_playwright

class AethelAnalyzer:
    def __init__(self):
        self.logs = []
        self.crashes = []
        self.js_errors = []
        self.stack_leaks = []
        self.thrashing = []
        self.infinite_loops = []

        self.kernel_depths = defaultdict(list)
        self.kernel_traces = defaultdict(list)
        self.bus_history = []

    def on_page_error(self, err):
        self.js_errors.append(str(err))

    def on_console(self, msg):
        text = msg.text
        self.logs.append(text)

        # Check for native WAForth undefined word errors which are dumped straight to console.error
        if msg.type == "error" and "Unknown word" in text:
            self.crashes.append({
                "kernel": "UNKNOWN (Native WAForth)",
                "error": text,
                "recent_traces": []
            })

        # Parse standard kernel logs: [KERNEL_NAME TIME] Message
        match = re.match(r'\[(.*?) \d{1,2}:\d{2}:\d{2}\] (.*)', text)
        if match:
            kernel_name = match.group(1)
            payload = match.group(2)

            # Detect Traces
            if "Line " in payload and "[DEPTH:" in payload:
                # payload might look like: "Line 45 [DEPTH: 2]"
                self.kernel_traces[kernel_name].append(payload)

                depth_match = re.search(r'\[DEPTH: (\d+)\]', payload)
                if depth_match:
                    depth = int(depth_match.group(1))
                    self.kernel_depths[kernel_name].append((len(self.logs), depth, payload))

            # Detect Crashes
            if "EXEC ERROR" in payload:
                self.crashes.append({
                    "kernel": kernel_name,
                    "error": payload,
                    "recent_traces": self.kernel_traces[kernel_name][-10:] if kernel_name in self.kernel_traces else []
                })

        # Detect orphaned packets or thrashing (if payload shows BUS_SEND)
        if "BUS_SEND" in text:
            self.bus_history.append(text)

    def analyze(self):
        print("\n==============================================")
        print("====== AETHELGARD DEBUG ANALYZER REPORT ======")
        print("==============================================\n")

        # 1. Crashes & Exceptions
        if self.crashes or self.js_errors:
            print(f"[!] CRITICAL: Found {len(self.crashes)} Kernel Crash(es) and {len(self.js_errors)} JS Exception(s).")
            for c in self.crashes:
                print(f"  > Kernel: {c['kernel']}")
                print(f"  > Error: {c['error']}")
                if c['recent_traces']:
                    print(f"  > Last 10 Traces:")
                    for t in c['recent_traces']:
                        print(f"      {t}")
            for err in self.js_errors:
                print(f"  > JS Exception: {err}")
        else:
            print("[OK] No Kernel Crashes or Unhandled JS Exceptions detected.")

        # 2. Stack Leaks
        # We look for a monotonic increase in minimum stack depth over time.
        leaks_found = 0
        for kernel, depths in self.kernel_depths.items():
            if len(depths) < 20:
                continue

            # Very naive heuristic: check if the 'resting' depth is increasing
            # Split into chunks of 100 trace instructions, find the minimum depth of each chunk
            chunks = [depths[i:i+100] for i in range(0, len(depths), 100)]
            min_depths = [min([d[1] for d in c]) for c in chunks]

            if len(min_depths) > 3:
                is_leaking = all(min_depths[i] < min_depths[i+1] for i in range(len(min_depths)-1))
                if is_leaking:
                    print(f"[!] WARNING: Potential Stack Leak in {kernel}.")
                    print(f"  > Resting stack depths over time: {min_depths}")
                    leaks_found += 1

        if leaks_found == 0:
            print("[OK] No obvious Stack Leaks detected.")

        # 3. Infinite Loops
        loops_found = 0
        for kernel, traces in self.kernel_traces.items():
            if len(traces) > 15000:
                print(f"[!] WARNING: Potential Infinite Loop in {kernel} ({len(traces)} trace logs recorded).")
                loops_found += 1

        if loops_found == 0:
            print("[OK] No Infinite Loops detected.")

        print("\n==============================================")
        print("Analysis Complete.")

def run():
    print("Starting Headless Aethelgard with ?debug=2 ...")
    analyzer = AethelAnalyzer()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("console", analyzer.on_console)
        page.on("pageerror", analyzer.on_page_error)

        try:
            page.goto("http://localhost:3001/?debug=2")
            time.sleep(2)

            print("Entering Mock Generation...")
            page.keyboard.press("Shift")
            page.mouse.click(10, 10)
            time.sleep(1)

            print("Traversing Level 1 (GRID)...")
            for _ in range(40):
                page.keyboard.press("ArrowRight")
                page.keyboard.press("ArrowDown")
                time.sleep(0.05)

            time.sleep(1)
            print("Traversing Level 2 (PLATFORM)...")
            for _ in range(25):
                page.keyboard.press("ArrowRight")
                time.sleep(0.1)
                if _ % 3 == 0:
                    page.keyboard.press("ArrowUp")

            time.sleep(1)
            print("Traversing Level 3 (BOSS GRID)...")
            for _ in range(15):
                page.keyboard.press("ArrowRight")
                page.keyboard.press("ArrowUp")
                time.sleep(0.05)
                page.keyboard.press("Space")

            time.sleep(2)

        except Exception as e:
            print(f"Playwright automation failed: {e}")
        finally:
            browser.close()
            analyzer.analyze()

if __name__ == "__main__":
    run()
