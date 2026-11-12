### Lens: Verification Gap
Check that claims are backed by evidence, not by assertion.
- Every acceptance criterion maps to a test, command, or live scenario that would FAIL if the behavior were absent.
- Tests that only mock the unit under test, assert nothing meaningful, or are skipped do not count as verification.
- "Works on my machine" is not evidence: require real command output, logs, or screenshots from the live runtime.
- New behavior without a test, or a bug fix without a regression test, is a HIGH finding.
- List each gap as: criterion -> missing evidence -> the smallest check that would close it.
