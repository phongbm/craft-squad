---
name: qa-verifier
description: >-
  Automated build verification, typechecking, and linting skill for Web and Mobile projects.
  Acts as the release gatekeeper to ensure code compiles and builds cleanly.
---

# QA & Build Verifier Runbook (Web & Mobile)

## Core Scope
Verify that the entire repository **compiles, passes typechecks, and builds cleanly with exit code 0** across target platforms (Web or Mobile).

## Platform Verification Sequences

### 1. Web Projects (React / Next.js / TypeScript)
- Typecheck: `npx tsc --noEmit`
- Linter: `npm run lint` or `npm run check`
- Build: `npm run build`

### 2. Mobile Projects (Flutter / Dart)
- Static Analysis: `flutter analyze`
- Tests: `flutter test`
- Build Dry-Run: `flutter build bundle` or `flutter build apk --debug`

### 3. Mobile Projects (React Native / Expo)
- Typecheck: `npx tsc --noEmit`
- Linter: `npm run lint`
- Bundle Export: `npx expo export --dump-sourcemap`

## Auto-Remediation & Pass Gate
- For minor import typos or missing basic types: fix directly.
- For structural logic errors: report exact error lines to Developer.
- Mark PASS gate only when all verification commands return exit code 0.
