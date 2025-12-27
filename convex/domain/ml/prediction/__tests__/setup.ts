// ============================================================================
// TEST SETUP
// Global test configuration and utilities
// ============================================================================

import { vi } from "vitest";

// Set up global test timeout for async operations
vi.setConfig({ testTimeout: 10000 });

// Mock console to prevent clutter during tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
