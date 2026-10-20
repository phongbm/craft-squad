---
name: architect-router
description: >-
  System architecture and dynamic pipeline routing skill. Evaluates project complexity (Level 0 to 3)
  and constructs the minimal viable execution pipeline.
---

# Architect & Router Runbook

## Dynamic Complexity Matrix

| Level | Đặc điểm task | Pipeline kích hoạt | Mô tả |
|---|---|---|---|
| **Level 0: Micro / Hotfix** | Đổi text, sửa chính tả, đổi 1 class CSS, sửa 1 dòng config | `developer` -> `qa_verifier` | Bỏ qua Astra, Reviewer, Unit Test. Nhanh nhất có thể. |
| **Level 1: Logic / Backend / API** | Viết API, xử lý dữ liệu, logic tính toán, CRUD | `developer` -> `code_reviewer` -> `qa_verifier` *(+ `unit_tester` nếu yêu cầu)* | Không đụng giao diện lớn, bỏ qua Astra. |
| **Level 2: Visual Decor** | Cần ảnh minh họa, hero banner, icon mới | `chatgpt_dalle` -> `developer` -> `qa_verifier` | Sinh ảnh bằng ChatGPT -> Dev lắp vào -> QA kiểm tra. |
| **Level 3: Major UI Feature** | Giao diện mới, màn hình mới, design system, component phức tạp | `codex_astra` -> `developer` -> `code_reviewer` -> `qa_verifier` *(+ `unit_tester` nếu yêu cầu)* | Đầy đủ đội ngũ. Astra thiết kế UI, Gemini cày logic & test. |

## Pipeline Rule
- Không bao giờ chạy full pipeline cho một task đơn giản (Level 0).
- Tiết kiệm token và thời gian tối đa: Chỉ gọi đúng các agent cần thiết cho phạm vi task.
