# PLAN-[ID]-[NAME]: [Technical Blueprint Title]

- **Spec / Epic:** [link or ID]
- **Decision status:** Proposed | Approved

## 1. Context & Constraints
<!-- Existing stack, conventions, and hard constraints discovered in the codebase. -->

## 2. Approach
<!-- The chosen design in 5-10 lines. If two or more viable options exist, list them with trade-offs and mark the recommendation (this triggers HITL Trigger 1). -->

## 3. Data Model & Schema Deltas
<!-- Entities, fields, migrations, indexes. Mark breaking changes. -->

## 4. API & Contract Changes
<!-- Endpoints, DTOs, events, error codes. Include request/response shapes. -->

## 5. Module Boundaries (Blast Radius)
- Allowed directories/modules:
  - `path/to/module/`
- Must NOT be touched:
  - `path/to/other/`

## 6. Risks & Open Questions
- [Risk] -> [Mitigation]

## 7. Verification Strategy
- Unit / integration / E2E commands that prove the design works.
