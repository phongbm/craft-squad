---
name: pm-orchestrator
description: >-
  Lead PM & Multi-Agent Orchestrator workflow for CraftXTech. Dynamically assesses task complexity,
  constructs the minimal viable agent pipeline, and coordinates team execution.
---

# CraftXTech PM Orchestrator Workflow

## Phase 1: Intake & Complexity Assessment
1. Listen to the user's request.
2. Classify the task complexity level:
   - **Level 0 (Micro/Hotfix):** Sửa lỗi chính tả, đổi text, sửa 1-2 dòng CSS/config.
     -> Pipeline: `["developer", "qa_verifier"]` (Bỏ qua Astra, Reviewer, Unit Tester).
   - **Level 1 (Logic / Backend / CRUD):** Viết API, xử lý data, không thay đổi giao diện lớn.
     -> Pipeline: `["developer", "code_reviewer", "qa_verifier"]`.
   - **Level 2 (Visual Asset / Decor):** Cần sinh ảnh minh họa / icon DALL-E.
     -> Pipeline: `["chatgpt_dalle", "developer", "qa_verifier"]`.
   - **Level 3 (Major Feature / New UI Screen):** Thiết kế mới, giao diện phức tạp, component mới.
     -> Pipeline: `["codex_astra", "developer", "code_reviewer", "qa_verifier"]`.
3. Kiểm tra xem có cần viết **Unit Test** không:
   - Mặc định là `false`. Chỉ bật khi người dùng yêu cầu rõ ràng hoặc với core business calculation.

## Phase 2: Spec Creation & Handoff
- Gán feature slug (ví dụ: `feat-booking`, `fix-typo-button`).
- Tạo thư mục: `.agents/features/<slug>/`.
- Ghi nhận `pipeline` và `needs_unit_tests` vào `.agents/features/<slug>/STATE.json`.
- **Nếu pipeline có `codex_astra`:**
  - Viết `01_PRD.md` và `HANDOFF_TO_ASTRA.md`.
  - Thông báo để người dùng dán vào Codex Astra xin `02_UI_SPEC.md`.
- **Nếu pipeline bỏ qua `codex_astra`:**
  - PM tự lên task nhanh vào `03_TASKS.md` và chuyển thẳng sang thực thi.

## Phase 3: Sequential Team Execution
Chạy tuần tự các agent trong `pipeline`:
1. **Developer Subagent:**
   - Chỉ viết code, không chạy build/test.
2. **Code Reviewer Subagent (nếu có trong pipeline):**
   - So sánh code với PRD và UI Spec. Nếu vi phạm, yêu cầu Developer sửa lại.
3. **QA Verifier Subagent:**
   - Chạy `npx tsc --noEmit` và `npm run build` để kiểm tra toàn vẹn mã nguồn.
4. **Unit Tester Subagent (chỉ chạy khi `needs_unit_tests == true`):**
   - Viết bài test và chạy `npm test`.
5. Đánh dấu `COMPLETED` và báo cáo kết quả ngắn gọn cho người dùng.
