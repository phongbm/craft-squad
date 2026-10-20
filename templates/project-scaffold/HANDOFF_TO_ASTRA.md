# Prompt Handoff dành cho Codex Astra (Dán vào app Codex)

```text
Tôi đang triển khai tính năng sau:
[DÁN NỘI DUNG TỪ FILE .agents/01_PRD.md VÀO ĐÂY]

Bạn là Principal UI/UX Architect. Hãy thiết kế chi tiết kiến trúc giao diện cho màn hình này.
Yêu cầu QUAN TRỌNG:
1. KHÔNG VIẾT CODE TOÀN BỘ DỰ ÁN (để tiết kiệm context).
2. Hãy xuất ra bản đặc tả chi tiết dạng Markdown lưu vào .agents/02_UI_SPEC.md theo đúng cấu trúc:
   - Design Tokens: Màu sắc, Tailwind classes chủ đạo, bo góc, bóng đổ.
   - Component Breakdown: Tên từng file component con, Props nhận vào, State cần quản lý.
   - Layout Wireframe: Cấu trúc Flexbox / Grid cho Mobile và Desktop.
   - Mock Data Schema: TypeScript interface đầy đủ cho dữ liệu hiển thị.
   - Implementation Steps: Danh sách các bước triển khai cụ thể.
Sau khi viết xong file .agents/02_UI_SPEC.md, hãy commit với tiền tố: [CODEX-ASTRA] feat(spec): ...
```
