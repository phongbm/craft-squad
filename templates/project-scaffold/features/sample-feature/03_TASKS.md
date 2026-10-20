# Tasks Checklist: Sample Feature

- [ ] **Task 1: [DELEGATE: CODEX-UI] Thiết kế Component Presentational**
  - **File:** `src/features/sample-feature/components/SampleCard.tsx`
  - **Mô tả:** Codex Astra xuất khung JSX + Tailwind classes + Props interface (Chưa cần nối logic/API).
  - **Acceptance Criteria:** Đẹp chuẩn responsive, đúng bảng màu thiết kế.

- [ ] **Task 2: [DELEGATE: GEMINI-DEV] Khởi tạo Types & State Management**
  - **File:** `src/features/sample-feature/types.ts` & `src/features/sample-feature/hooks/useSample.ts`
  - **Mô tả:** Gemini Developer khai báo interface TypeScript và logic quản lý state.
  - **Acceptance Criteria:** Xử lý đầy đủ loading, error, success state.

- [ ] **Task 3: [DELEGATE: GEMINI-DEV] Lắp ráp Component & Kết nối API**
  - **File:** `src/features/sample-feature/index.tsx`
  - **Mô tả:** Ghép UI từ Task 1 và State từ Task 2 thành tính năng hoàn chỉnh.
  - **Acceptance Criteria:** Chạy trơn tru, không thay đổi class Tailwind của Task 1.

- [ ] **Task 4: [DELEGATE: GEMINI-REVIEW] Code Review & UI Audit**
  - **Mô tả:** Gemini Code Reviewer đối chiếu code thực tế với 02_UI_SPEC.md.
  - **Acceptance Criteria:** Phán quyết PASS, không lệch màu sắc/layout.

- [ ] **Task 5: [DELEGATE: GEMINI-QA] Build & Typecheck**
  - **Mô tả:** Gemini QA Verifier chạy `npx tsc --noEmit` và `npm run build`.
  - **Acceptance Criteria:** Build thành công với exit code 0.
