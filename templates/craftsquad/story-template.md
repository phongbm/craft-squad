# STORY-[ID]-[NAME]: [Tên Story]

- **Epic:** EPIC-[ID]-[NAME]
- **Route:** [Route A (Direct) | Route B (UI-first) | Route C (Architecture-first) | Route D (Full design)]
- **Assignees:** [Architect / UI Designer] -> Developer -> Code Reviewer -> Tester -> QA Gatekeeper

## 1. INPUT (Đầu vào & Phụ thuộc)
<!-- Schemas, DTOs, API contracts, design tokens, hay các component phụ thuộc -->
- Schema/DTO:
- Design Tokens / Layout Ref:
- Dependencies:

## 2. OUTPUT (Đầu ra bắt buộc)
<!-- Danh sách file cụ thể sẽ tạo/sửa. Cấm sửa file ngoài danh sách này -->
- Files to create/edit:
  - `path/to/file1.ts`
  - `path/to/file2.tsx`
- Endpoints / Components exported:
  - `POST /api/v1/...`
  - `<ComponentName />`

## 3. ACCEPTANCE CRITERIA (Given - When - Then)
- **AC-01:** Given [tiền đề], When [hành động], Then [kết quả mong đợi].
- **AC-02:** Given [tiền đề lỗi], When [hành động sai], Then [mã lỗi và thông báo].

## 4. VERIFICATION METHOD
<!-- Kịch bản thực thi để Tester và QA Gatekeeper nghiệm thu thực tế -->
- Test command / Script:
- Browser E2E Scenario (nếu là UI):
  1. Mở `http://localhost:3000/...`
  2. Thao tác...
  3. Kiểm tra kết quả...
