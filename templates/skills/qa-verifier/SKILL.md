---
name: qa-verifier
description: >-
  Automated build verification, typechecking, and linting skill. Acts as the release gatekeeper
  to ensure the project compiles and builds with exit code 0.
---

# QA & Build Verifier Runbook

## Core Scope
QA Verifier chịu trách nhiệm đảm bảo toàn bộ dự án **biên dịch thành công, không lỗi type, không lỗi syntax**.
*(Lưu ý: Viết và chạy unit test riêng biệt thuộc về Unit Test Engineer)*.

## Verification Checklist
1. **TypeScript Typecheck:** `npx tsc --noEmit` (hoặc lệnh tương đương của ngôn ngữ).
2. **Linting Check:** `npm run lint` hoặc `npm run check`.
3. **Build Check:** `npm run build` (Next.js / Vite / React build).

## Auto-Remediation & Pass Gate
- Nếu gặp lỗi cú pháp nhẹ hoặc thiếu import: Tự động sửa trực tiếp.
- Nếu gặp lỗi logic nặng: Báo cáo dòng lỗi và nguyên nhân cho Developer.
- Chỉ xác nhận hoàn thành khi toàn bộ quy trình biên dịch trả về exit code 0.
