# Technical & UI Specification

## 1. Nền tảng & Thiết lập chung
- **Nền tảng:** [Web | Flutter | React Native | iOS | Android]
- **Design Tokens / Theme Constants:**
  - Bảng màu: Primary, Secondary, Background, Text
  - Typography Scale
  - Spacing & Corner Radius (Bo góc)

## 2. Tiêu chuẩn UX Mobile (Nếu làm Mobile App)
- **Safe Area Insets:** Xử lý tai thỏ / dynamic island / navigation bar
- **Touch Targets:** Tối thiểu 44-48pt/dp cho các nút bấm và icon
- **Mobile Navigation:** Bottom navigation bar / Stack push-pop / Modal bottom sheet

## 3. Component Breakdown (Presentational Components)
- `src/features/...` (hoặc `lib/features/...` cho Flutter)
  - Tên Component / Widget:
  - Props / Inputs:
  - Styling / Layout: (Tailwind classes hoặc Flutter Widget properties)
  - Responsive / Multi-device support: (Mobile, Tablet, Desktop)

## 4. Data Schema & Mock Fixtures
```typescript
// hoặc Dart class nếu là Flutter
export interface DataItem {
  id: string;
  title: string;
}
```
