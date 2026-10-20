---
name: code-reviewer
description: >-
  Code Review & Audit skill. Inspects code changes against PRD, UI Spec (Astra fidelity),
  clean code practices, and security before verification.
---

# Code Reviewer Runbook

## Review Checklist
1. **UI Fidelity (Độ trung thực với bản vẽ của Astra):**
   - So sánh code với `02_UI_SPEC.md`.
   - Kiểm tra xem Developer có tự ý đổi màu sắc, bo góc, spacing hay responsive breakpoints không.
2. **Clean Code & Robustness:**
   - Xử lý các trường hợp null/undefined, error handling khi gọi API.
   - Không chứa code thừa, console.log thừa, hay comment `// TODO`.
3. **Security:**
   - Không hardcode API keys, secrets, credentials.

## Review Output Format
- **Nếu PASS:**
  > `[REVIEW PASS]: Code tuân thủ đúng 100% UI Spec và tiêu chuẩn Clean Code. Sẵn sàng đưa sang QA Verifier.`
- **Nếu REJECT:**
  > `[REVIEW REJECT]: Phát hiện các điểm cần sửa:`
  > 1. `File A, dòng X`: Vi phạm UI Spec (yêu cầu màu `bg-indigo-600` nhưng code dùng `bg-blue-500`).
  > 2. `File B, dòng Y`: Thiếu try/catch khi fetch API.
  > *(Yêu cầu Developer sửa lại các mục trên)*
