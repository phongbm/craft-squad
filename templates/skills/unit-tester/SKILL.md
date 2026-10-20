---
name: unit-tester
description: >-
  Specialized Unit Test creation and execution skill. Invoked on-demand when PM requests
  unit test coverage for critical business logic or calculation modules.
---

# Unit Test Engineer Runbook

## Core Principles
1. **On-Demand Execution:** Only write unit tests when explicitly requested by PM or PRD (`needs_unit_tests: true`).
2. **Focus on Core Business Logic:**
   - Calculations, data transformations, helper utilities.
   - State transition machines and custom hooks.
   - Boundary conditions: empty sets, nulls, special characters, edge values.
3. **Mock Dependencies:**
   - Mock all external network calls, file system APIs, and databases for fast, deterministic execution.

## Execution Sequence
1. Inspect the logic files in `src/features/<feature-slug>/...` or `lib/features/<feature-slug>/...`.
2. Create corresponding test files (e.g. `*.test.ts`, `*_test.dart`).
3. Execute the test runner: `npm test -- <path>` or `flutter test <path>`.
4. Ensure 100% of test cases pass before declaring completion.
