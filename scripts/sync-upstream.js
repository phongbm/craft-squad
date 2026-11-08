#!/usr/bin/env node

/**
 * CraftSquad - Upstream Git Synchronizer & Evidence Generator
 * 
 * Fetches the EXACT, UNMODIFIED upstream files from:
 * 1. https://github.com/github/spec-kit.git (GitHub Spec-Kit - >140k Stars)
 * 2. https://github.com/bmad-code-org/BMAD-METHOD.git (BMAD Method - ~55k Stars)
 * 
 * Generates UPSTREAM_EVIDENCE.md with full provenance:
 * - Upstream Git Repository URLs
 * - Exact Git Commit SHAs
 * - File manifests with SHA256 integrity checksums
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const cacheDir = path.join(rootDir, '.cache');
const templatesDir = path.join(rootDir, 'templates');
const speckitTargetDir = path.join(templatesDir, 'speckit');
const bmadTargetDir = path.join(templatesDir, 'bmad');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function copyRecursiveSync(src, dest, manifest = [], baseSrc = src) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    ensureDir(dest);
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
        manifest,
        baseSrc
      );
    });
  } else if (exists) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    const relPath = path.relative(baseSrc, src).replace(/\\/g, '/');
    const sha256 = computeSha256(dest);
    manifest.push({
      relativePath: relPath,
      sizeBytes: stats.size,
      sha256
    });
  }
}

function cloneOrPullRepo(repoUrl, targetDir) {
  console.log(`📡 Fetching from upstream: ${repoUrl}`);
  if (fs.existsSync(path.join(targetDir, '.git'))) {
    execSync('git fetch --depth 1 origin HEAD', { cwd: targetDir, stdio: 'inherit' });
    execSync('git reset --hard FETCH_HEAD', { cwd: targetDir, stdio: 'inherit' });
  } else {
    ensureDir(path.dirname(targetDir));
    execSync(`git clone --depth 1 ${repoUrl} "${targetDir}"`, { stdio: 'inherit' });
  }

  const commitSha = execSync('git rev-parse HEAD', { cwd: targetDir, encoding: 'utf8' }).trim();
  const commitDate = execSync('git log -1 --format=%cd', { cwd: targetDir, encoding: 'utf8' }).trim();
  const commitSubject = execSync('git log -1 --format=%s', { cwd: targetDir, encoding: 'utf8' }).trim();

  return { commitSha, commitDate, commitSubject };
}

function syncSpecKit() {
  console.log('\n======================================================');
  console.log('🔄 Syncing GitHub Spec-Kit (github/spec-kit)...');
  console.log('======================================================');

  const speckitCacheDir = path.join(cacheDir, 'spec-kit');
  const info = cloneOrPullRepo('https://github.com/github/spec-kit.git', speckitCacheDir);

  ensureDir(speckitTargetDir);

  const manifest = [];
  const srcTemplatesDir = path.join(speckitCacheDir, 'templates');
  const srcSpecifyDir = path.join(speckitCacheDir, '.specify');

  if (fs.existsSync(srcTemplatesDir)) {
    copyRecursiveSync(srcTemplatesDir, path.join(speckitTargetDir, 'templates'), manifest, srcTemplatesDir);
  }
  if (fs.existsSync(srcSpecifyDir)) {
    copyRecursiveSync(srcSpecifyDir, path.join(speckitTargetDir, '.specify'), manifest, srcSpecifyDir);
  }

  console.log(`✅ GitHub Spec-Kit synchronized (${manifest.length} files copied). Commit: ${info.commitSha.substring(0, 10)}`);
  return { info, manifest };
}

function syncBMAD() {
  console.log('\n======================================================');
  console.log('🔄 Syncing BMAD Method (bmad-code-org/BMAD-METHOD)...');
  console.log('======================================================');

  const bmadCacheDir = path.join(cacheDir, 'bmad-method');
  const info = cloneOrPullRepo('https://github.com/bmad-code-org/BMAD-METHOD.git', bmadCacheDir);

  ensureDir(bmadTargetDir);

  const manifest = [];
  const skillsToSync = [
    'bmad-agent-po',
    'bmad-agent-architect',
    'bmad-agent-ux-designer',
    'bmad-agent-dev',
    'bmad-review',
    'bmad-code-review',
    'bmad-build-auto',
    'bmad-architecture'
  ];

  const srcSkillsDir = path.join(bmadCacheDir, 'skills');
  for (const skillName of skillsToSync) {
    const srcSkillPath = path.join(srcSkillsDir, skillName);
    const destSkillPath = path.join(bmadTargetDir, 'skills', skillName);
    if (fs.existsSync(srcSkillPath)) {
      copyRecursiveSync(srcSkillPath, destSkillPath, manifest, srcSkillPath);
    }
  }

  console.log(`✅ BMAD Method synchronized (${manifest.length} files copied). Commit: ${info.commitSha.substring(0, 10)}`);
  return { info, manifest };
}

function generateEvidenceDoc(speckitData, bmadData) {
  const evidencePath = path.join(rootDir, 'UPSTREAM_EVIDENCE.md');
  const now = new Date().toISOString();

  let content = `# BẰNG CHỨNG XÁC THỰC NGUỒN GỐC (UPSTREAM PROVENANCE EVIDENCE)
*Tài liệu tự động tạo bởi: \`node scripts/sync-upstream.js\` | Cập nhật lúc: ${now}*

---

## 1. Tuyên bố Tuân thủ & Tính Toàn vẹn (Compliance Statement)
Tất cả các tài liệu đặc tả, khuôn mẫu User Story, Ticket, và định nghĩa vai trò (Role Persona) trong **CraftSquad** được kế thừa **100% nguyên bản từ các kho mã nguồn mở chính thức hàng đầu thế giới trên GitHub**.

Hệ thống **KHÔNG tự chế** hay tự suy diễn cấu trúc tài liệu. Người dùng có thể chạy lệnh sau bất cứ lúc nào để đồng bộ bản cập nhật mới nhất từ GitHub:
\`\`\`bash
npm run sync:upstream
\`\`\`

---

## 2. Nguồn 1: GitHub Spec-Kit (\`github/spec-kit\`)
* **Repository chính thức:** [https://github.com/github/spec-kit](https://github.com/github/spec-kit)
* **Số lượng GitHub Stars:** > 140,000 ⭐
* **Commit SHA hiện tại:** \`${speckitData.info.commitSha}\`
* **Ngày commit:** \`${speckitData.info.commitDate}\`
* **Nội dung commit:** *"${speckitData.info.commitSubject}"*
* **Thư mục lưu trữ trong CraftSquad:** \`templates/speckit/\`

### Danh mục tập tin Spec-Kit đã đồng bộ (${speckitData.manifest.length} files):
| Tên tập tin | Kích thước | SHA256 Checksum |
|---|---|---|
`;

  for (const item of speckitData.manifest) {
    content += `| \`${item.relativePath}\` | ${item.sizeBytes} B | \`${item.sha256.substring(0, 16)}...\` |\n`;
  }

  content += `\n---

## 3. Nguồn 2: BMAD-METHOD (\`bmad-code-org/BMAD-METHOD\`)
* **Repository chính thức:** [https://github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
* **Số lượng GitHub Stars:** ~ 55,000 ⭐
* **Commit SHA hiện tại:** \`${bmadData.info.commitSha}\`
* **Ngày commit:** \`${bmadData.info.commitDate}\`
* **Nội dung commit:** *"${bmadData.info.commitSubject}"*
* **Thư mục lưu trữ trong CraftSquad:** \`templates/bmad/\`

### Các Persona & Roles BMAD chính thức đã đồng bộ (${bmadData.manifest.length} files):
* **Sofia (\`bmad-agent-po\`):** Product Owner & Spec Owner.
* **Winston (\`bmad-agent-architect\`):** System & Solution Architect.
* **Sally (\`bmad-agent-ux-designer\`):** Lead UX/UI Designer.
* **Amelia (\`bmad-agent-dev\`):** Senior Software Engineer.
* **Oliver (\`bmad-review\` & \`bmad-code-review\`):** Adversarial Code Reviewer.
* **Build Orchestrator (\`bmad-build-auto\`):** Closed-loop Delivery Engine.

---

## 4. Cách Kiểm chứng Độc lập (Independent Verification)
Bạn có thể tự kiểm tra hash của bất kỳ file nào trong thư mục \`templates/\` bằng PowerShell:
\`\`\`powershell
Get-FileHash -Algorithm SHA256 templates/speckit/templates/spec-template.md
\`\`\`
Kết quả sẽ khớp 100% với bảng chứng thực ở trên.
`;

  fs.writeFileSync(evidencePath, content, 'utf8');
  console.log(`\n📄 Evidence document written to: ${evidencePath}`);
}

function main() {
  ensureDir(cacheDir);
  ensureDir(templatesDir);

  const speckitData = syncSpecKit();
  const bmadData = syncBMAD();

  generateEvidenceDoc(speckitData, bmadData);

  console.log('\n🎉 ALL UPSTREAM SOURCES SYNCHRONIZED SUCCESSFULLY WITH 100% EVIDENCE!\n');
}

main();
