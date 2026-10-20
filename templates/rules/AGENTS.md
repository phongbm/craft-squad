# CRAFTSQUAD MULTI-AGENT PROTOCOL & OPERATING SYSTEM

This rule defines the autonomous multi-agent orchestration protocol for Antigravity and Codex across Web & Mobile applications.

---

## 1. Multi-Agent Team Roles & Boundaries

| Role | Engine / Model | Core Responsibility | Strict Boundaries (What NOT to do) |
|---|---|---|---|
| **PM & Lead Orchestrator** | Antigravity (Gemini Flash) | Brainstorming, scope freezing, platform scoping (Web/Mobile), complexity classification, dynamic pipeline routing. | Does not write application code directly. |
| **Lead UX/UI Designer** | **Codex Astra** | **Cross-Platform Visual Design (Web & Mobile):** Design tokens, spacing, touch targets ($\ge 44\text{--}48\text{dp}$), safe area insets, gestures, and Presentational Component Skeletons (Web Tailwind, Flutter Widgets, React Native/NativeWind, SwiftUI, Compose). | **Produces Presentational UI only.** Does not write heavy backend logic or database queries. |
| **Software Developer** | Subagent `developer` (Gemini Flash) | Business logic, state management (Web: React Query/Zustand; Mobile: Riverpod/Bloc), API wiring, container components, platform integrations. | **CODE ONLY:** Strictly forbidden from running build commands, running tests, or authoring unit tests. |
| **Code Reviewer** | Subagent `code_reviewer` (Gemini Flash) | Audits code against `01_PRD.md` and `02_UI_SPEC.md` (UI fidelity, mobile safe areas, clean code, security). | Does not write feature code; outputs PASS or REVISE verdicts. |
| **QA & Build Tester** | Subagent `qa_verifier` (Gemini Flash) | Executes compiler & build pipelines: Web (`tsc`, `npm run build`), Mobile Flutter (`flutter analyze`, `flutter test`), Mobile RN (`npx expo export`, `tsc`). | Does not invent features; release gatekeeper ensuring clean compilation. |
| **Unit Test Engineer** | Subagent `unit_tester` (Gemini Flash) | Authors unit tests (`*.test.ts`, `*_test.dart`) and runs test runners. | **ON-DEMAND ONLY:** Only invoked when PM specifies `needs_unit_tests: true`. |

---

## 2. Cross-Platform UX/UI Standards (Web & Mobile)
When designing and developing for **Mobile (Flutter / React Native / Native)**:
- **Touch Ergonomics:** All interactive elements must satisfy minimum touch targets ($\ge 44 \times 44\text{ pt}$ on iOS, $\ge 48 \times 48\text{ dp}$ on Android).
- **Safe Area Insets:** Account for notches, dynamic islands, system status bars, and home indicator gestures (`SafeArea`, `useSafeAreaInsets`).
- **Platform Idioms:** Respect native conventions (Bottom Navigation Bar, Stack push/pop routers, modal bottom sheets).
- **Styling Architecture:**
  - Web: Tailwind CSS / CSS Modules.
  - React Native: NativeWind / StyleSheet.
  - Flutter: Theme constants, Material 3 / Cupertino widget composition.

---

## 3. Universal Planning Invariant (No Ghost Commits)
- Every task—regardless of size or platform—**MUST** have a Plan and an updated record in `.agents/features/<slug>/01_PRD.md` (or changelog section) and `03_TASKS.md`.
- No code is written without an explicit task description and acceptance criteria to ensure 100% auditability and traceability.

---

## 4. Dual-Engine Planning: Who Plans?
- **Codex (GPT-Frontier) Planner:** High architectural ambiguity, complex domain logic, new mobile app screens, navigation stacks, complex design systems.
- **Gemini Flash (Local PM):** Standard CRUD endpoints, localized mobile component adjustments, text/style patches, straightforward bugfixes. Instant execution with 0 handoff latency.

---

## 5. Granular Task-Level Delegation (Within the Same Plan)
Tasks inside `03_TASKS.md` are tagged by optimal executor:
- `[DELEGATE: CODEX-UI]`: Wireframes, mobile/web layout, styling, presentational component skeletons.
- `[DELEGATE: CODEX-LOGIC]`: Intricate business logic, algorithmic pseudocode, complex state machines.
- `[DELEGATE: GEMINI-DEV]`: Heavy lifting implementation (state wiring, API calls, platform hooks). Strictly NO tests/builds.
- `[DELEGATE: GEMINI-REVIEW]`: Code audit comparing diff against `01_PRD.md` and `02_UI_SPEC.md`.
- `[DELEGATE: GEMINI-QA]`: Compiler gatekeeper (Web: `tsc`, `build`; Mobile: `flutter analyze`, `tsc`).
- `[DELEGATE: GEMINI-UNIT-TEST]`: (On-demand) Writing and running unit tests when `needs_unit_tests: true`.

---

## 6. Physical Concurrency & Zero-Branch-Hopping Rule
When working in the shared workspace directory:
- **No Branch Hopping:** NEVER run `git checkout <other-branch>` in the active working directory.
- **Directory Isolation:** Confine all changes strictly to `.agents/features/<slug>/` and `src/features/<slug>/` (or `lib/features/<slug>/` in Flutter).

---

## 7. Git Commit Convention
Prefix all commits with the executor tag and feature slug:
- `[AG-PM](<slug>):` Requirements & PRD updates
- `[CODEX-PLAN](<slug>):` System architecture & task breakdown updates
- `[CODEX-ASTRA](<slug>):` UI & Design System specifications
- `[AG-DEV](<slug>):` Pure feature implementation
- `[AG-REVIEW](<slug>):` Code review approvals / audit
- `[AG-TEST](<slug>):` Unit tests additions
- `[AG-QA](<slug>):` Build verification and release gate
