# STORY-[ID]-[NAME]: [Story Title]

- **Epic:** EPIC-[ID]-[NAME]
- **Route:** [Route A (Direct) | Route B (UI-first) | Route C (Architecture-first) | Route D (Full design)]
- **Assignees:** [Architect / UI Designer] -> Developer -> Code Reviewer -> Tester -> QA Gatekeeper

## 1. INPUT (Dependencies & Contracts)
<!-- Schemas, DTOs, API contracts, design tokens, or dependent components -->
- Schema/DTO:
- Design Tokens / Layout Ref:
- Dependencies:

## 2. OUTPUT (Required Deliverables)
<!-- Explicit files to create/modify. Do not edit files outside this list -->
- Files to create/edit:
  - `path/to/file1.ts`
  - `path/to/file2.tsx`
- Exported endpoints / components:
  - `POST /api/v1/...`
  - `<ComponentName />`

## 3. ACCEPTANCE CRITERIA (Given - When - Then)
- **AC-01:** Given [precondition], When [action], Then [expected outcome].
- **AC-02:** Given [error precondition], When [invalid action], Then [expected error code and message].

## 4. VERIFICATION METHOD
<!-- Execution scenario for Tester and QA Gatekeeper -->
- Test command / Script:
- Browser E2E Scenario (if UI):
  1. Open `http://localhost:3000/...`
  2. Perform action...
  3. Verify result...
