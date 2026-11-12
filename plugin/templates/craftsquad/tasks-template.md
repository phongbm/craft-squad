# TASKS-[ID]-[NAME]: [Epic Title]

<!-- Ordered, atomic work items derived from the Epic. [P] marks tasks safe to run in parallel (different files, no dependency). -->

## Phase 1: Foundations
- [ ] T001 [Setup / schema / contract] - `path/to/file`
- [ ] T002 [P] [Independent foundation task] - `path/to/file`

## Phase 2: Stories
- [ ] T010 [STORY-01] [Implement ...] - `path/to/file`
- [ ] T011 [STORY-01] [Tests for ...] - `path/to/test`
- [ ] T020 [P] [STORY-02] [Implement ...] - `path/to/file`

## Phase 3: Verification
- [ ] T090 Run build/test gate (exit code 0 required)
- [ ] T091 Run live E2E scenario from each Story's VERIFICATION METHOD

## Dependencies
- T010 blocks T011
- Phase 2 starts after Phase 1 completes

## Rules
- Every task names the exact file(s) it touches; files outside the Epic Blast Radius are forbidden.
- A task is done only with evidence (test output, diff, screenshot), never on a verbal claim.
