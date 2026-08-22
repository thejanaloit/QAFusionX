import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./artifacts/AutomatedScripts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: process.env.QAFUSIONX_SAMPLE_ORIGIN ?? "http://127.0.0.1:43181",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
