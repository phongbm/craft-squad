# Prompt Handoff dành cho Codex Astra (Dán vào app Codex)

```text
Tôi đang triển khai tính năng: [<TÊN FEATURE / SLUG>]
Nền tảng mục tiêu: [Web (React/Next.js/Tailwind) | Mobile (Flutter) | Mobile (React Native/Expo) | Mobile (SwiftUI/Compose)]
Dưới đây là nội dung PRD:
[DÁN NỘI DUNG TỪ FILE .agents/features/<slug>/01_PRD.md VÀO ĐÂY]

Bạn là Principal UX/UI Architect (Chuyên sâu cả Web và Mobile). Hãy thiết kế chi tiết kiến trúc giao diện cho màn hình này.
Yêu cầu QUAN TRỌNG:
1. KHÔNG VIẾT TOÀN BỘ LOGIC/BACKEND (để tiết kiệm context).
2. Hãy xuất ra bản đặc tả chi tiết dạng Markdown lưu vào: .agents/features/<slug>/02_UI_SPEC.md theo đúng nền tảng mục tiêu:
   - Nếu là WEB: Design Tokens, Tailwind CSS classes, Layout Flex/Grid, Component Props interface.
   - Nếu là MOBILE (Flutter/React Native): Cấu trúc Widget/Component tree, Safe Area insets, Touch targets (min 48dp), Navigation pattern (Bottom tabs/Stack/Modal), Styling (NativeWind/StyleSheet hoặc ThemeData/Constants).
3. Component Breakdown: Xuất các Presentational Components (Khung giao diện thuần, props hiển thị dữ liệu mẫu, chưa gắn API/state phức tạp).
4. TUYỆT ĐỐI KHÔNG chạy git checkout đổi branch.
5. Sau khi viết xong file, hãy commit với tiền tố: [CODEX-ASTRA](<slug>): update UI spec for [Web/Mobile]
```
