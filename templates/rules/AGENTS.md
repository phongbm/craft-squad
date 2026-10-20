# CRAFTXTECH MULTI-AGENT PROTOCOL & OPERATING SYSTEM

This rule defines the complete engineering team architecture, role boundaries, and dynamic workflow pipelines.

---

## 1. The 6-Role Software Engineering Team

| Role | Agent / Model | Single Responsibility | Boundaries (What NOT to do) |
|---|---|---|---|
| **1. PM & Lead Orchestrator** | Antigravity (Gemini Flash) | Brainstorming, scope lock, complexity classification, dynamic pipeline routing. | Does not write application code directly. |
| **2. Lead UX/UI Designer** | Codex Astra | Visual design, responsive layout, Tailwind tokens, Presentational Component Skeletons. | Does not write heavy backend logic or database queries. |
| **3. Software Developer** | Subagent `developer` (Gemini Flash) | Business logic, state management, API wiring, container components. | **STRICT BOUNDARY:** Does NOT run `npm run build`, does NOT run `npm test`, and does NOT write unit tests. |
| **4. Code Reviewer** | Subagent `code_reviewer` (Gemini Flash) | Audits code against `01_PRD.md` and `02_UI_SPEC.md` (UI fidelity check), clean code, security. | Does not write feature code; outputs PASS or REVISE feedback. |
| **5. QA & Build Tester** | Subagent `qa_verifier` (Gemini Flash) | Executes compiler & build pipeline: `npx tsc --noEmit`, `npm run lint`, `npm run build`. | Does not invent features; focuses on compilation and runtime integrity. |
| **6. Unit Test Engineer** | Subagent `unit_tester` (Gemini Flash) | Writes unit tests (`*.test.ts`, `*.spec.tsx`) and runs `npm test`. | **ON-DEMAND ONLY:** Only invoked when PM specifies `needs_unit_tests: true`. |

---

## 2. Dynamic Adaptive Routing (Complexity-Aware Pipeline)

The system does **NOT** force every task through a heavy pipeline. The PM dynamically selects the minimal viable pipeline based on complexity:

```text
Task Assessment:
├── Level 0 (Trivial / Hotfix / Text tweak)
│   └── Pipeline: Developer -> QA Verifier -> Complete (Skip Astra, Skip Review, Skip Unit Test)
│
├── Level 1 (Logic / API / CRUD - No UI changes)
│   └── Pipeline: Developer -> Code Reviewer -> QA Verifier -> (Optional Unit Tester)
│
├── Level 2 (Visual / Decor Asset required)
│   └── Pipeline: ChatGPT (DALL-E 3) -> Developer -> QA Verifier
│
└── Level 3 (Major Feature / New UI Screen / Complex Design)
    └── Pipeline: Codex Astra (UX/UI) -> Developer -> Code Reviewer -> QA Verifier -> (Optional Unit Tester)
```

---

## 3. Strict Physical Concurrency & Zero-Branch-Hopping Rule
When working in the shared workspace directory:
- **No Branch Hopping:** NEVER run `git checkout <other-branch>` in the active working directory.
- **Directory Isolation:**
  - Feature docs: `.agents/features/<feature-slug>/`
  - Feature code: `src/features/<feature-slug>/` (or designated component paths)

---

## 4. Git Commit Convention
When committing changes, prefix commits with the role and feature slug:
- `[AG-PM](<slug>):` Requirements & PRD updates
- `[CODEX-ASTRA](<slug>):` UI & Design System specifications
- `[AG-DEV](<slug>):` Pure feature implementation
- `[AG-REVIEW](<slug>):` Code review approvals / audit
- `[AG-TEST](<slug>):` Unit tests additions
- `[AG-QA](<slug>):` Build verification and release gate
