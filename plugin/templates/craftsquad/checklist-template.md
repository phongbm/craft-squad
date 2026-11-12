# CHECKLIST-[ID]-[NAME]: [Subject]

<!-- Requirement-quality or verification checklist. Each item must be answerable yes/no with evidence. -->

## Requirements Quality
- [ ] CHK001 Every requirement is testable and has an acceptance criterion
- [ ] CHK002 Edge cases and failure modes are specified, not implied
- [ ] CHK003 No unresolved [NEEDS CLARIFICATION] markers remain
- [ ] CHK004 In-scope and out-of-scope are explicit

## Runtime Verification
- [ ] CHK010 Environment precondition confirmed (service/container/dev server is really running)
- [ ] CHK011 Each acceptance criterion exercised against the live system
- [ ] CHK012 Error paths exercised (invalid input, unauthorized, empty state)
- [ ] CHK013 Evidence attached (command output, log excerpt, screenshot)

## Result
- Verdict: PASS | FAIL
- Failed items and reproduction steps:
