---
name: qa-verifier
description: >-
  Automated build verification, typechecking, and linting skill for Web and Mobile projects.
  Acts as the release gatekeeper to ensure code compiles and builds cleanly.
---

# QA & Build Verifier Runbook (Web & Mobile)

## Core Scope
Đảm bảo toàn bộ dự án **biên dịch thành công, không lỗi type, không lỗi syntax** trên nền tảng mục tiêu (Web hoặc Mobile).

## Verification Sequences theo Nền tảng

### 1. Dành cho Web (React / Next.js / Vue / TypeScript)
- Typecheck: `npx tsc --noEmit`
- Linter: `npm run lint` hoặc `npm run check`
- Build: `npm run build`

### 2. Dành cho Mobile Flutter (Dart)
- Static Analysis: `flutter analyze`
- Tests: `flutter test`
- Build Dry-Run: `flutter build bundle` hoặc `flutter build apk --debug`

### 3. Dành cho Mobile React Native / Expo
- Typecheck: `npx tsc --noEmit`
- Linter: `npm run lint`
- Expo Bundle Check: `npx expo export --dump-sourcemap`

## Auto-Remediation & Pass Gate
- Nếu phát hiện lỗi import, sai cú pháp nhẹ: Tự động sửa trực tiếp.
- Chỉ gắn mác PASS khi toàn bộ script kiểm tra trả về exit code 0.
