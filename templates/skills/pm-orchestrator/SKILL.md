---
name: pm-orchestrator
description: >-
  Lead PM & Multi-Agent Orchestrator workflow for CraftXTech. Enforces universal planning,
  selects the planning engine (Codex vs Gemini), and delegates tasks with granular model tagging.
---

# CraftXTech PM Orchestrator Workflow

## Phase 1: Intake & Universal Documentation (Bắt buộc cho mọi task)
1. Lắng nghe yêu cầu từ người dùng.
2. Gán hoặc xác định feature slug (ví dụ: `feat-booking`, `fix-checkout-btn`).
3. Đảm bảo thư mục `.agents/features/<slug>/` tồn tại.
4. **Cập nhật tài liệu (Universal Rule):**
   - Với task lớn: Viết đầy đủ `01_PRD.md`.
   - Với task nhỏ / hotfix: Cập nhật phần `Changelog / Quick Patch` trong `01_PRD.md`.
   - *Tuyệt đối không bỏ qua bước này để đảm bảo khả năng truy vết mã nguồn (Traceability).*

## Phase 2: Dual-Engine Planning Decision (Chọn AI lập Kế hoạch)
Đánh giá độ sâu lý luận cần thiết cho bản kế hoạch:
- **Chọn Codex Planner (Frontier Reasoning):** Khi tính năng mới có kiến trúc phức tạp, nghiệp vụ đa tầng hoặc yêu cầu thiết kế UI/UX cao cấp.
  -> Xuất file `HANDOFF_TO_CODEX_PLANNER.md` để người dùng dán vào Codex lấy bản Plan chi tiết.
- **Chọn Gemini Planner (Local Fast Plan):** Khi bài toán rõ ràng, theo khuôn mẫu có sẵn, logic chuẩn hoặc sửa lỗi cục bộ.
  -> Gemini PM tự lập Plan và phân rã task ngay tại chỗ.

## Phase 3: Granular Task Breakdown (`03_TASKS.md`)
Trong file `03_TASKS.md`, mỗi task phải được gán thẻ thực thi rõ ràng:
- `- [ ] Task N: [DELEGATE: CODEX-UI] ...`: Dành cho Codex Astra thiết kế component giao diện & Tailwind.
- `- [ ] Task N: [DELEGATE: CODEX-LOGIC] ...`: Dành cho Codex Astra viết pseudocode / thuật toán khó.
- `- [ ] Task N: [DELEGATE: GEMINI-DEV] ...`: Dành cho Gemini Developer viết code logic, state, API.
- `- [ ] Task N: [DELEGATE: GEMINI-REVIEW] ...`: Dành cho Gemini Reviewer audit code.
- `- [ ] Task N: [DELEGATE: GEMINI-QA] ...`: Dành cho Gemini QA Verifier build & compile check.
- `- [ ] Task N: [DELEGATE: GEMINI-UNIT-TEST] ...`: (Tùy chọn) Viết unit test khi có yêu cầu.

## Phase 4: Điều Phối Thực Thi Tuần Tự
1. Nếu có task `[DELEGATE: CODEX-...]`: Chuẩn bị prompt handoff và đợi người dùng dán kết quả vào spec.
2. Với các task `[DELEGATE: GEMINI-DEV]`: Kích hoạt subagent `developer` code từng phần.
3. Với task `[DELEGATE: GEMINI-REVIEW]`: Kích hoạt `code_reviewer` đối chiếu với spec.
4. Với task `[DELEGATE: GEMINI-QA]`: Kích hoạt `qa_verifier` chạy build/lint.
5. Cập nhật `STATE.json` (`phase: "COMPLETED"`) và báo cáo kết quả cho người dùng.
