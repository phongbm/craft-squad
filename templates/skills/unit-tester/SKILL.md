---
name: unit-tester
description: >-
  Specialized Unit Test creation and execution skill. Invoked on-demand when PM requests
  unit test coverage for critical business logic or calculation modules.
---

# Unit Test Engineer Runbook

## Core Principles
1. **Chỉ làm việc khi có lệnh:** Không tự ý viết unit test cho các task thông thường trừ khi PM hoặc PRD yêu cầu rõ (`needs_unit_tests: true`).
2. **Tập trung vào Logic cốt lõi:**
   - Các hàm tính toán, transform data, utility helpers.
   - Các state transitions phức tạp hoặc custom hooks.
   - Edge cases: mảng rỗng, dữ liệu null, chuỗi chứa ký tự đặc biệt, boundary numbers.
3. **Mocking Dependencies:**
   - Luôn mock các external API calls, database, và router để bài test chạy độc lập và nhanh chóng.

## Execution Sequence
1. Đọc code logic tại `src/features/<feature-slug>/...`.
2. Tạo file test tương ứng: `src/features/<feature-slug>/__tests__/<module>.test.ts` (hoặc định dạng test của dự án).
3. Chạy lệnh thực thi test: `npm test -- <path-to-test-file>`.
4. Nếu test fail: Kiểm tra xem do bài test viết sai hay do code logic có bug. Nếu logic có bug, báo lại cho Developer sửa.
5. Đảm bảo toàn bộ test case PASS 100%.
