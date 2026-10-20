# Prompt Handoff dành cho Codex khi cần Lập Kế Hoạch / Kiến Trúc (Dán vào app Codex)

```text
Tôi đang khởi tạo tính năng: [<TÊN FEATURE / SLUG>]
Dưới đây là mô tả yêu cầu ban đầu:
[DÁN NỘI DUNG TỪ FILE .agents/features/<slug>/01_PRD.md VÀO ĐÂY]

Bạn là Lead System Architect & Product Strategist (GPT-Frontier). Hãy thiết kế bản kế hoạch kiến trúc toàn diện cho tính năng này.
Yêu cầu QUAN TRỌNG:
1. KHÔNG VIẾT CODE HOÀN CHỈNH. Hãy tập trung vào tư duy kiến trúc và phân rã bài toán.
2. Hãy cập nhật hoặc tạo file .agents/features/<slug>/03_TASKS.md theo chuẩn phân bổ nhiệm vụ:
   - Các task liên quan đến UI/UX, Component Markup, Tailwind gắn nhãn: [DELEGATE: CODEX-UI]
   - Các task liên quan đến thuật toán khó, state machine phức tạp gắn nhãn: [DELEGATE: CODEX-LOGIC] (kèm pseudocode/hướng dẫn)
   - Các task liên quan đến lắp ráp code, API, state thông thường gắn nhãn: [DELEGATE: GEMINI-DEV]
   - Luôn kèm theo 2 task cuối: [DELEGATE: GEMINI-REVIEW] và [DELEGATE: GEMINI-QA].
3. TUYỆT ĐỐI KHÔNG chạy git checkout đổi branch.
4. Sau khi viết xong, hãy commit với tiền tố: [CODEX-PLAN](<slug>): architectural task breakdown
```
