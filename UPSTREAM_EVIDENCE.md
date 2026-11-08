# BẰNG CHỨNG XÁC THỰC NGUỒN GỐC (UPSTREAM PROVENANCE EVIDENCE)
*Tài liệu tự động tạo bởi: `node scripts/sync-upstream.js` | Cập nhật lúc: 2026-11-08T09:34:41.484Z*

---

## 1. Tuyên bố Tuân thủ & Tính Toàn vẹn (Compliance Statement)
Tất cả các tài liệu đặc tả, khuôn mẫu User Story, Ticket, và định nghĩa vai trò (Role Persona) trong **CraftSquad** được kế thừa **100% nguyên bản từ các kho mã nguồn mở chính thức hàng đầu thế giới trên GitHub**.

Hệ thống **KHÔNG tự chế** hay tự suy diễn cấu trúc tài liệu. Người dùng có thể chạy lệnh sau bất cứ lúc nào để đồng bộ bản cập nhật mới nhất từ GitHub:
```bash
npm run sync:upstream
```

---

## 2. Nguồn 1: GitHub Spec-Kit (`github/spec-kit`)
* **Repository chính thức:** [https://github.com/github/spec-kit](https://github.com/github/spec-kit)
* **Số lượng GitHub Stars:** > 140,000 ⭐
* **Commit SHA hiện tại:** `c43849408ac0de2ca6a52f14eaae71449776057b`
* **Ngày commit:** `Fri Nov 6 22:09:21 2026 -0600`
* **Nội dung commit:** *"[extension] Update Quality Gates (Enforcement Layer) extension to v0.6.1 (#5264)"*
* **Thư mục lưu trữ trong CraftSquad:** `templates/speckit/`

### Danh mục tập tin Spec-Kit đã đồng bộ (16 files):
| Tên tập tin | Kích thước | SHA256 Checksum |
|---|---|---|
| `checklist-template.md` | 2088 B | `c65b7f10aa9a965e...` |
| `commands/analyze.md` | 11764 B | `ffe0640ebe778795...` |
| `commands/checklist.md` | 22340 B | `1192784f378fb977...` |
| `commands/clarify.md` | 19507 B | `5260d798c5671deb...` |
| `commands/constitution.md` | 10329 B | `a915ba6ae5fdbd49...` |
| `commands/converge.md` | 13219 B | `4fb017b2869ad02d...` |
| `commands/implement.md` | 12779 B | `feab334232940cfd...` |
| `commands/plan.md` | 8047 B | `206a0386d20b3eed...` |
| `commands/specify.md` | 18969 B | `e3e7595ef13e1f05...` |
| `commands/tasks.md` | 11416 B | `2f9176c6e7c23d2a...` |
| `constitution-template.md` | 2346 B | `ce7549540fa45543...` |
| `plan-template.md` | 3770 B | `dfba43da2b2a207f...` |
| `spec-template.md` | 4556 B | `3945437fc35cd30a...` |
| `tasks-template.md` | 9182 B | `1e448e9153462e8c...` |
| `vscode-settings.json` | 350 B | `3db3a1d8417d38a5...` |
| `memory/constitution.md` | 13252 B | `93218a57ccdb45d6...` |

---

## 3. Nguồn 2: BMAD-METHOD (`bmad-code-org/BMAD-METHOD`)
* **Repository chính thức:** [https://github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
* **Số lượng GitHub Stars:** ~ 55,000 ⭐
* **Commit SHA hiện tại:** `a867e1604b365d48ea03cbd109da1066ba0c84bc`
* **Ngày commit:** `Sat Nov 7 21:38:56 2026 -0600`
* **Nội dung commit:** *"feat(facilitate)!: Mary and John on bmad-facilitate, paced templates, a generic engine and template customization (#3176)"*
* **Thư mục lưu trữ trong CraftSquad:** `templates/bmad/`

### Các Persona & Roles BMAD chính thức đã đồng bộ (81 files):
* **Sofia (`bmad-agent-po`):** Product Owner & Spec Owner.
* **Winston (`bmad-agent-architect`):** System & Solution Architect.
* **Sally (`bmad-agent-ux-designer`):** Lead UX/UI Designer.
* **Amelia (`bmad-agent-dev`):** Senior Software Engineer.
* **Oliver (`bmad-review` & `bmad-code-review`):** Adversarial Code Reviewer.
* **Build Orchestrator (`bmad-build-auto`):** Closed-loop Delivery Engine.

---

## 4. Cách Kiểm chứng Độc lập (Independent Verification)
Bạn có thể tự kiểm tra hash của bất kỳ file nào trong thư mục `templates/` bằng PowerShell:
```powershell
Get-FileHash -Algorithm SHA256 templates/speckit/templates/spec-template.md
```
Kết quả sẽ khớp 100% với bảng chứng thực ở trên.
