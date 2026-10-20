# CraftSquad 🚀

> **The 6-Role Autonomous Software Engineering Squad for Web & Mobile.**  
> Hỗ trợ đa nền tảng **Web & Mobile (Flutter, React Native, Next.js)**, điều phối thông minh với mô hình **Dual-Engine Planning** và **Granular Task Delegation**.

---

## 📱 Cross-Platform: UX/UI Cho Cả Web Lẫn Mobile

CraftSquad không giới hạn ở Web HTML/CSS. Vai trò **UX/UI Designer (Codex Astra)** và **Developer (Gemini)** được tối ưu hóa cho cả ứng dụng di động:

* **Mobile App (Flutter / Dart):**
  * Codex Astra xuất cấu trúc Widget Tree, Theme constants, Safe Area, Touch targets ($\ge 48\text{dp}$), Bottom sheets, Navigation Stack.
  * Gemini Developer lắp ráp State Management (Riverpod, Bloc), gọi API và xử lý data.
  * QA Verifier chạy `flutter analyze` và `flutter test`.
* **Mobile App (React Native / Expo):**
  * Codex Astra xuất Component JSX với NativeWind hoặc StyleSheet, tính toán Safe Area Insets.
  * Gemini Developer quản lý State (Zustand, React Query) và tích hợp native hooks.
  * QA Verifier kiểm tra typecheck và bundle.
* **Web Application (React / Next.js / Tailwind):**
  * Quy trình chuẩn Tailwind CSS, Flex/Grid, responsive breakpoints.

---

## 👥 Đội Ngũ 6 Role Chuyên Biệt

| Role | Model | Trách nhiệm (Web & Mobile) | Ranh giới nghiêm ngặt |
|---|:---:|---|---|
| **1. PM & Orchestrator** | Gemini Flash | Brainstorm, khóa scope, xác định nền tảng (Web/Mobile), chọn pipeline. | Không viết code trực tiếp. |
| **2. Lead UX/UI Designer** | **Codex Astra** | **Thiết kế UI/UX đa nền tảng**: Web Tailwind, Flutter Widgets, React Native, Mobile UX (Safe Area, Touch targets $\ge 48\text{dp}$). | **Chỉ xuất Presentational Component**. Không làm backend/database. |
| **3. Software Developer** | Gemini Flash | Lắp logic, state (React Query, Riverpod, Bloc), gọi API, routing. | **CHỈ VIẾT CODE:** Tuyệt đối không tự chạy build, không tự test, không viết unit test. |
| **4. Code Reviewer** | Gemini Flash | Soát lỗi code, kiểm tra độ trung thực với UI Spec của Astra, mobile ergonomics. | Không viết code tính năng; phán quyết PASS hoặc REVISE. |
| **5. QA Build Verifier** | Gemini Flash | Chạy kiểm tra biên dịch: Web (`tsc`, `build`), Flutter (`flutter analyze`), RN (`expo export`). | Không sáng tạo tính năng; đảm bảo build xanh 100%. |
| **6. Unit Test Engineer** | Gemini Flash | Viết bài test logic (`*.test.ts`, `*_test.dart`) và chạy test runner. | **CHỈ CHẠY KHI CÓ YÊU CẦU** (`needs_unit_tests: true`). |

---

## ⚡ Dual-Engine Planning & Granular Task Delegation

```markdown
- [ ] Task 1: [DELEGATE: CODEX-UI] Xuất Presentational UI (Flutter Widget / React Native / Web Tailwind)
- [ ] Task 2: [DELEGATE: CODEX-LOGIC] Thuật toán tính toán nghiệp vụ / State machine phức tạp
- [ ] Task 3: [DELEGATE: GEMINI-DEV] Lắp ráp State, kết nối API, Form validation (Chỉ viết code)
- [ ] Task 4: [DELEGATE: GEMINI-REVIEW] Code Review & UI Audit đối chiếu với Spec
- [ ] Task 5: [DELEGATE: GEMINI-QA] Build & Typecheck (tsc / flutter analyze)
- [ ] Task 6: [DELEGATE: GEMINI-UNIT-TEST] (On-Demand) Viết Unit Test nếu có yêu cầu
```

---

## 📂 Cấu Trúc Repo

```text
craft-squad/
├── bin/
│   └── cli.js                     # CLI cài đặt tự động (npx craft-squad init)
├── scripts/
│   └── watcher.js                 # File watcher đệ quy đa tính năng
├── templates/
│   ├── plugin.json                # Manifest Plugin
│   ├── rules/
│   │   └── AGENTS.md              # Quy tắc 6 Role, Web & Mobile, Concurrency
│   ├── skills/                    # 6 Skills chuyên trách
│   │   ├── pm-orchestrator/
│   │   ├── architect-router/
│   │   ├── dev-executor/
│   │   ├── code-reviewer/
│   │   ├── qa-verifier/           # Hỗ trợ Web, Flutter, React Native
│   │   └── unit-tester/
│   └── project-scaffold/          # Bộ khung .agents/ đặt trong dự án
│       ├── STATE.json
│       ├── features/
│       │   └── sample-feature/
│       │       ├── 01_PRD.md
│       │       ├── 02_UI_SPEC.md  # Chuẩn UI Spec Web & Mobile
│       │       ├── 03_TASKS.md
│       │       └── STATE.json
│       ├── HANDOFF_TO_ASTRA.md    # Handoff đa nền tảng
│       ├── HANDOFF_TO_CODEX_PLANNER.md
│       ├── HANDOFF_TO_CHATGPT.md
│       └── git-hooks/
│           └── post-commit
├── package.json
└── README.md
```

---

## 🚀 Cài Đặt và Sử Dụng

```bash
npx craft-squad init
```
1. Mở Antigravity trên điện thoại (Thread 1) để tương tác với PM.
2. Mở Codex trên điện thoại (Thread 2) để nhận các task `[DELEGATE: CODEX-...]`.
3. Cho dù dự án là **Web (Next.js)** hay **Mobile App (Flutter / React Native)**, CraftSquad đều tự động nhận diện và áp dụng đúng tiêu chuẩn kỹ thuật!
