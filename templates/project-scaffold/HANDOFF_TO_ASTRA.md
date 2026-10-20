# Prompt Handoff dành cho Codex Astra (Dán vào app Codex)

```text
Tôi đang triển khai tính năng: [<TÊN FEATURE / SLUG>]
Dưới đây là nội dung PRD:
[DÁN NỘI DUNG TỪ FILE .agents/features/<slug>/01_PRD.md VÀO ĐÂY]

Bạn là Principal UI/UX Architect. Hãy thiết kế chi tiết kiến trúc giao diện cho màn hình này.
Yêu cầu QUAN TRỌNG:
1. KHÔNG VIẾT TOÀN BỘ SOURCE CODE DỰ ÁN (để tiết kiệm context).
2. Hãy xuất ra bản đặc tả chi tiết dạng Markdown lưu vào: .agents/features/<slug>/02_UI_SPEC.md
   - Design Tokens: Màu sắc, Tailwind classes chủ đạo, bo góc, bóng đổ.
   - Component Breakdown: Tên từng file component con (trong src/features/<slug>/...), Props nhận vào, State cần quản lý.
   - Layout Wireframe: Cấu trúc Flexbox / Grid cho Mobile và Desktop.
   - Mock Data Schema: TypeScript interface đầy đủ cho dữ liệu hiển thị.
   - Implementation Steps: Danh sách các bước triển khai chi tiết.
3. TUYỆT ĐỐI KHÔNG chạy git checkout đổi branch.
4. Sau khi viết xong file, hãy commit với tiền tố: [CODEX-ASTRA](<slug>): update UI spec
```
