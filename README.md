# CraftXTech Multi-Agent Orchestrator Kit 🚀

> **Hệ thống điều phối đội ngũ AI Agent (PM, Astra Architect, Gemini Developer, QA Verifier) dành cho Antigravity 2.0 và Codex.**  
> Tối ưu hóa 100% cho việc điều khiển từ xa qua điện thoại (Mobile Remote), hỗ trợ chạy nhiều Chat/Tính năng song song mà không sợ xung đột vật lý trên ổ cứng.

---

## 💡 Triết Lý Thiết Kế

1. **Zero API Key Cost (Tận dụng thuê bao có sẵn):**
   * Sử dụng **Codex Astra** đúng 1 lần cho việc lập bản vẽ UI/UX Blueprint (tiết kiệm hạn mức).
   * Sử dụng **Antigravity (Gemini 3.8 Flash)** cho toàn bộ công việc nặng: viết code, tự sửa lỗi, chạy test và build.
2. **Mobile-First & Single Persistent Thread:**
   * Không tạo chat mới liên tục làm rác giao diện.
   * Cả dự án chỉ duy trì **1 Thread duy nhất trên Antigravity** và **1 Thread duy nhất trên Codex**.
   * Hai bên tự động nhận biết công việc của nhau thông qua file trạng thái `.agents/STATE.json` và Git.
3. **Physical Concurrency & Zero-Branch-Hopping (Chạy song song không xung đột):**
   * Nhận thức rõ giới hạn vật lý: **1 thư mục ổ cứng chỉ đứng ở 1 Git branch tại một thời điểm**.
   * Để chạy nhiều chat/tính năng song song: **Tuyệt đối không switch branch qua lại**. Thay vào đó, áp dụng cơ chế **Feature Namespacing**:
     * Mọi tài liệu agent nằm trong: `.agents/features/<feature-slug>/`
     * Mọi source code nằm trong: `src/features/<feature-slug>/`
   * Nhờ đó, 2 hay 5 Chat AI có thể làm việc cùng 1 lúc mà không bao giờ đá văng code của nhau!

---

## 📂 Cấu Trúc Repo

```text
craftxtech-agent/
├── bin/
│   └── cli.js                     # CLI cài đặt tự động (npx craftxtech-agent init)
├── scripts/
│   └── watcher.js                 # File watcher tự động phát hiện khi Astra/PM ghi file
├── templates/
│   ├── plugin.json                # Manifest Global Plugin cho Antigravity
│   ├── rules/
│   │   └── AGENTS.md              # Quy tắc điều phối Lead PM, Concurrency & Git Convention
│   ├── skills/                    # 4 Skills chuyên biệt
│   │   ├── pm-orchestrator/
│   │   ├── architect-router/
│   │   ├── dev-executor/
│   │   └── qa-verifier/
│   └── project-scaffold/          # Bộ khung .agents/ đặt trong dự án
│       ├── STATE.json             # Máy trạng thái chung đa tính năng
│       ├── features/              # Thư mục chứa từng tính năng độc lập
│       │   └── sample-feature/
│       │       ├── 01_PRD.md
│       │       ├── 02_UI_SPEC.md
│       │       ├── 03_TASKS.md
│       │       └── STATE.json
│       ├── HANDOFF_TO_ASTRA.md
│       ├── HANDOFF_TO_CHATGPT.md
│       └── git-hooks/
│           └── post-commit        # Git Hook tự động đồng bộ & push notification
├── package.json                   # Sẵn sàng để publish lên npm
├── .gitignore
└── README.md
```

---

## ⚡ Cài Đặt Nhanh (Installation)

### Chạy trực tiếp qua NPX:
```bash
npx craftxtech-agent init
```
Lệnh này sẽ tự động:
1. Cài đặt **Global Plugin** vào Antigravity (`~/.gemini/config/plugins/craftxtech-agent`).
2. Khởi tạo bộ thư mục **`.agents/`** kèm đầy đủ template và feature structure.
3. Kích hoạt tự động **Git Hook** tại `.git/hooks/post-commit`.

---

## 📱 Vận Hành Khi Mở Nhiều Chat Song Song (Multi-Chat)

Khi bạn mở 2 tab chat Antigravity trên điện thoại để làm 2 việc cùng lúc:

1. **Tab Chat 1:** Bạn nói: *"PM ơi, làm tính năng Đặt xe"*
   * PM tự động tạo slug: `feat-booking`.
   * Tạo thư mục: `.agents/features/feat-booking/` và code trong `src/features/feat-booking/`.
2. **Tab Chat 2:** Bạn nói: *"PM ơi, làm tính năng Đổi Avatar"*
   * PM tự động tạo slug: `feat-avatar`.
   * Tạo thư mục: `.agents/features/feat-avatar/` và code trong `src/features/feat-avatar/`.
3. **Hoàn toàn an toàn:** Hai bên chạy song song trên cùng 1 branch mà không cần switch branch, không bao giờ ghi đè file của nhau!

---

## 🏷️ Quy Ước Git Commit

| Tiền tố Commit | Người thực hiện | Ý nghĩa |
|---|---|---|
| `[AG-PM](<slug>):` | Antigravity PM | Đã hoàn thành PRD cho feature `<slug>`. |
| `[CODEX-ASTRA](<slug>):` | Codex Astra | Đã hoàn thành UI Spec cho feature `<slug>`. |
| `[AG-DEV](<slug>):` | Gemini Developer | Đang triển khai code trong `src/features/<slug>/`. |
| `[AG-QA](<slug>):` | QA Verifier | Đã pass toàn bộ kiểm thử và build cho `<slug>`. |

---

## 🔔 Nhận Thông Báo Push Về Điện Thoại (ntfy.sh)

Trong file `.agents/STATE.json`, bạn có thể đổi kênh thông báo:
```json
{
  "notification_channel": "craftxtech-alerts"
}
```
Tải app **ntfy** (iOS/Android) và đăng ký topic này để nhận thông báo tức thì khi Agent hoàn thành từng bước.
