---
name: architect-router
description: >-
  System architecture and task routing skill. Evaluates whether planning requires Codex or Gemini,
  and breaks down features into granular tasks tagged by optimal model capability.
---

# Architect & Router Runbook

## 1. Dual-Engine Planning Matrix

| Tiêu chí | Gemini Planner (Local) | Codex Planner (Frontier) |
|---|---|---|
| **Độ phức tạp bài toán** | Thấp đến trung bình, có mẫu rõ ràng. | Cao, nhiều tầng nghiệp vụ, trừu tượng. |
| **Phạm vi thay đổi** | Cục bộ 1-3 files, fix bug, CRUD chuẩn. | Hệ thống mới, luồng dữ liệu mới, UI/UX mới. |
| **Độ trễ & Thao tác** | Tức thì trong 2s, 0 thao tác copy-paste. | Cần 1 lần copy-paste qua app Codex. |

## 2. Granular Task Tagging Matrix

Khi lập `03_TASKS.md`, phân bổ từng task theo đúng sở trường:

| Thẻ phân bổ | Model thực hiện | Nội dung công việc |
|---|:---:|---|
| `[DELEGATE: CODEX-UI]` | Codex Astra | Tạo khung JSX/HTML, Tailwind classes, Responsive breakpoints, Props interface. |
| `[DELEGATE: CODEX-LOGIC]` | Codex Astra | Viết thuật toán khó, luồng state phức tạp, xử lý dữ liệu nhiều bước (Pseudocode). |
| `[DELEGATE: GEMINI-DEV]` | Gemini Flash | Lắp ráp UI + Logic thành code hoàn chỉnh, nối state, fetch API, validation. *(Không test/build)*. |
| `[DELEGATE: GEMINI-REVIEW]` | Gemini Flash | So sánh code diff với UI Spec và PRD, kiểm tra clean code & bảo mật. |
| `[DELEGATE: GEMINI-QA]` | Gemini Flash | Chạy `npx tsc --noEmit`, `npm run lint`, `npm run build`. |
| `[DELEGATE: GEMINI-UNIT-TEST]` | Gemini Flash | Viết `*.test.ts` và chạy `npm test` khi có yêu cầu từ PM. |
