### Lens: Edge Case Hunter
Walk every branch and boundary the diff introduces and ask what input reaches it that the author did not test.
- Boundaries: empty, null/undefined, zero, negative, max length, duplicate, unicode, time zones, large collections.
- State: first run vs repeat run, partial failure midway, retry, concurrent writers, stale cache.
- Control flow: unreachable branches, swallowed errors, missing `else`/default, early returns skipping cleanup.
- Resources: unclosed handles, unbounded loops or queries (N+1), missing timeouts.
- Security: unvalidated input, missing authorization checks, secrets in logs.
For each gap report: `file:line`, the triggering input, the wrong outcome, and a concrete fix.
