# Tasks Checklist: Sample Feature

- [ ] **Task 1: [DELEGATE: CODEX-UI] Presentational Component Markup**
  - **File:** `src/features/sample-feature/components/SampleCard.tsx`
  - **Description:** Author presentational JSX with Tailwind classes and Props interface.
  - **Acceptance Criteria:** Matches 02_UI_SPEC.md exactly, responsive layout.

- [ ] **Task 2: [DELEGATE: GEMINI-DEV] State Management & Types**
  - **File:** `src/features/sample-feature/types.ts` & `src/features/sample-feature/hooks/useSample.ts`
  - **Description:** Implement TypeScript interfaces and state management.
  - **Acceptance Criteria:** Clean typed interfaces, proper loading and error states.

- [ ] **Task 3: [DELEGATE: GEMINI-DEV] Assembly & Integration**
  - **File:** `src/features/sample-feature/index.tsx`
  - **Description:** Connect UI component with state logic.
  - **Acceptance Criteria:** Zero console warnings, functional interactions.

- [ ] **Task 4: [DELEGATE: GEMINI-REVIEW] Code Review & UI Audit**
  - **Description:** Cross-check diff against 02_UI_SPEC.md.
  - **Acceptance Criteria:** Review verdict PASS, no styling regressions.

- [ ] **Task 5: [DELEGATE: GEMINI-QA] Verification & Build**
  - **Description:** Execute `npx tsc --noEmit` and `npm run build`.
  - **Acceptance Criteria:** Exit code 0.
