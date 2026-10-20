# CRAFTSQUAD MULTI-AGENT PROTOCOL & OPERATING SYSTEM

This rule defines the engineering team architecture, cross-platform capabilities (Web & Mobile), dual-engine planning system, and granular task delegation matrix for CraftSquad.

---

## 1. The 6-Role Software Engineering Team

| Role | Agent / Model | Single Responsibility | Boundaries (What NOT to do) |
|---|---|---|---|
| **1. PM & Lead Orchestrator** | Antigravity (Gemini Flash) | Brainstorming, scope lock, platform definition (Web/Mobile), complexity classification, dynamic pipeline routing. | Does not write application code directly. |
| **2. Lead UX/UI Designer** | **Codex Astra** | **Cross-Platform Visual Design (Web & Mobile):** Design tokens, spacing, touch targets (min 48px), safe area insets, gestures, and Presentational Component Skeletons (Web Tailwind, Flutter Widgets, React Native/NativeWind, SwiftUI, Jetpack Compose). | Does not write heavy backend logic or database queries. |
| **3. Software Developer** | Subagent `developer` (Gemini Flash) | Business logic, state management (Web: React Query/Zustand; Mobile: Riverpod/Bloc/Zustand), API wiring, container components, platform permissions. | **STRICT BOUNDARY:** Does NOT run build commands, does NOT run tests, and does NOT write unit tests. |
| **4. Code Reviewer** | Subagent `code_reviewer` (Gemini Flash) | Audits code against `01_PRD.md` and `02_UI_SPEC.md` (UI fidelity check, mobile safe areas, touch targets, clean code, security). | Does not write feature code; outputs PASS or REVISE feedback. |
| **5. QA & Build Tester** | Subagent `qa_verifier` (Gemini Flash) | Executes compiler & build pipeline: Web (`tsc`, `npm run build`), Mobile Flutter (`flutter analyze`, `flutter build`), Mobile RN (`npx expo export`, `tsc`). | Does not invent features; focuses on compilation and runtime integrity. |
| **6. Unit Test Engineer** | Subagent `unit_tester` (Gemini Flash) | Writes unit tests (`*.test.ts`, `*_test.dart`) and runs test runner. | **ON-DEMAND ONLY:** Only invoked when PM specifies `needs_unit_tests: true`. |

---

## 2. Cross-Platform UX/UI Standards (Web & Mobile)
When designing and implementing for **Mobile (Flutter / React Native / Native)**:
- **Ergonomics & Touch Targets:** All interactive elements must adhere to minimum touch targets ($\ge 44 \times 44$ pt on iOS, $\ge 48 \times 48$ dp on Android).
- **Safe Area Insets:** Account for notches, dynamic islands, system status bars, and home indicator gestures (`SafeArea`, `useSafeAreaInsets`).
- **Platform Idioms:** Respect native conventions (Bottom Navigation Bar vs Drawer, Cupertino back swipe gestures vs Android back button).
- **Styling Architecture:**
  - Web: Tailwind CSS / CSS Modules.
  - React Native: NativeWind / StyleSheet.
  - Flutter: Custom theme constants, Material 3 / Cupertino widget compositions.

---

## 3. The Universal Planning Invariant (No Ghost Commits)
- Every single task—regardless of size or platform—MUST have a Plan and an updated record in `.agents/features/<slug>/01_PRD.md` and `03_TASKS.md`.
- No code is ever written without an explicit task and acceptance criteria.

---

## 4. Dual-Engine Planning: Who Creates the Plan?
- **Codex (GPT-Frontier) Planner:** High architectural ambiguity, complex domain logic, new mobile app screens, navigation stacks, design systems.
- **Gemini Flash (Local PM):** Standard CRUD endpoints, localized mobile component adjustments, text/style patches, straightforward bugfixes.

---

## 5. Granular Task-Level Delegation (Within the Same Plan)
- `[DELEGATE: CODEX-UI]`: Component wireframes, mobile/web layout, styling, presentational component skeletons.
- `[DELEGATE: CODEX-LOGIC]`: Intricate business logic, algorithmic pseudocode, complex mobile state machines.
- `[DELEGATE: GEMINI-DEV]`: Heavy lifting implementation (state wiring, API calls, platform hooks). Strictly NO tests/builds.
- `[DELEGATE: GEMINI-REVIEW]`: Code audit comparing code diff against `01_PRD.md` and `02_UI_SPEC.md`.
- `[DELEGATE: GEMINI-QA]`: Compiler gatekeeper (Web: `tsc`, `build`; Mobile: `flutter analyze`, `tsc`).
- `[DELEGATE: GEMINI-UNIT-TEST]`: (On-demand) Writing and running unit tests when `needs_unit_tests: true`.

---

## 6. Strict Physical Concurrency & Zero-Branch-Hopping Rule
- **No Branch Hopping:** NEVER run `git checkout <other-branch>` in the shared working directory.
- **Directory Isolation:** Confine all changes strictly to `.agents/features/<slug>/` and `src/features/<slug>/` (or `lib/features/<slug>/` in Flutter).
