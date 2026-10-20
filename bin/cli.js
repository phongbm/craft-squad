#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0] || 'init';

const userHome = os.homedir();
const packageRootDir = path.resolve(__dirname, '..');
const templatesDir = path.join(packageRootDir, 'templates');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function installGlobalPlugin() {
  console.log('📦 Đang cài đặt Global Plugin vào Antigravity...');
  const targetGlobalDir = path.join(userHome, '.gemini', 'config', 'plugins', 'craftxtech-agent');

  // Copy manifest, rules, skills
  if (!fs.existsSync(targetGlobalDir)) {
    fs.mkdirSync(targetGlobalDir, { recursive: true });
  }

  fs.copyFileSync(path.join(templatesDir, 'plugin.json'), path.join(targetGlobalDir, 'plugin.json'));
  copyRecursiveSync(path.join(templatesDir, 'rules'), path.join(targetGlobalDir, 'rules'));
  copyRecursiveSync(path.join(templatesDir, 'skills'), path.join(targetGlobalDir, 'skills'));

  console.log(`✅ Global Plugin đã được cài đặt tại: ${targetGlobalDir}`);
}

function initProjectScaffold() {
  console.log('🚀 Đang khởi tạo bộ khung Multi-Agent (.agents/) trong dự án hiện tại...');
  const targetProjectAgentsDir = path.join(process.cwd(), '.agents');
  const scaffoldSourceDir = path.join(templatesDir, 'project-scaffold');

  copyRecursiveSync(scaffoldSourceDir, targetProjectAgentsDir);
  console.log(`✅ Đã khởi tạo thư mục: ${targetProjectAgentsDir}`);

  // Setup Git hook if .git folder exists
  const gitHooksDir = path.join(process.cwd(), '.git', 'hooks');
  if (fs.existsSync(gitHooksDir)) {
    const hookSource = path.join(scaffoldSourceDir, 'git-hooks', 'post-commit');
    const hookTarget = path.join(gitHooksDir, 'post-commit');
    try {
      fs.copyFileSync(hookSource, hookTarget);
      // Ensure executable permissions on unix-like systems
      try { fs.chmodSync(hookTarget, '755'); } catch (e) {}
      console.log('✅ Đã tự động kích hoạt Git Hook tại: .git/hooks/post-commit');
    } catch (err) {
      console.warn('⚠️ Không thể cài đặt git hook tự động:', err.message);
    }
  } else {
    console.log('ℹ️ Thư mục hiện tại chưa có .git. Hãy chạy `git init` để sử dụng tính năng auto-hook.');
  }
}

switch (command) {
  case 'global':
  case 'install-global':
    installGlobalPlugin();
    break;

  case 'project':
    initProjectScaffold();
    break;

  case 'init':
  case 'setup':
  default:
    console.log('\n======================================================');
    console.log('🌟 CraftXTech Multi-Agent Orchestrator Setup 🌟');
    console.log('======================================================\n');
    installGlobalPlugin();
    initProjectScaffold();
    console.log('\n🎉 HOÀN TẤT THIẾT LẬP!');
    console.log('📌 Hướng dẫn sử dụng:');
    console.log('1. Mở Antigravity Web trên điện thoại -> Giữ 1 Thread duy nhất cho PM.');
    console.log('2. Mở Codex trên điện thoại -> Giữ 1 Thread duy nhất cho Astra.');
    console.log('3. Hai agent sẽ tự động giao tiếp đồng bộ qua file .agents/STATE.json và Git!\n');
    break;

  case 'watch':
    require('../scripts/watcher.js');
    break;
}
