#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

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
  console.log('📦 Installing Global Plugin into Antigravity...');
  const targetGlobalDir = path.join(userHome, '.gemini', 'config', 'plugins', 'craft-squad');

  if (!fs.existsSync(targetGlobalDir)) {
    fs.mkdirSync(targetGlobalDir, { recursive: true });
  }

  fs.copyFileSync(path.join(templatesDir, 'plugin.json'), path.join(targetGlobalDir, 'plugin.json'));
  copyRecursiveSync(path.join(templatesDir, 'rules'), path.join(targetGlobalDir, 'rules'));
  copyRecursiveSync(path.join(templatesDir, 'skills'), path.join(targetGlobalDir, 'skills'));

  console.log(`✅ Global Plugin installed at: ${targetGlobalDir}`);
}

function initProjectScaffold() {
  console.log('🚀 Initializing CraftSquad scaffold (.agents/) in current project...');
  const targetProjectAgentsDir = path.join(process.cwd(), '.agents');
  const scaffoldSourceDir = path.join(templatesDir, 'project-scaffold');

  copyRecursiveSync(scaffoldSourceDir, targetProjectAgentsDir);
  console.log(`✅ Scaffold initialized at: ${targetProjectAgentsDir}`);

  // Setup Git hook if .git folder exists
  const gitHooksDir = path.join(process.cwd(), '.git', 'hooks');
  if (fs.existsSync(gitHooksDir)) {
    const hookSource = path.join(scaffoldSourceDir, 'git-hooks', 'post-commit');
    const hookTarget = path.join(gitHooksDir, 'post-commit');
    try {
      fs.copyFileSync(hookSource, hookTarget);
      try { fs.chmodSync(hookTarget, '755'); } catch (e) {}
      console.log('✅ Git Hook automatically activated at: .git/hooks/post-commit');
    } catch (err) {
      console.warn('⚠️ Unable to install git hook automatically:', err.message);
    }
  } else {
    console.log('ℹ️ No .git directory detected. Run `git init` to enable automatic hook sync.');
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
    console.log('🌟 CraftSquad: Autonomous Multi-Agent Orchestrator 🌟');
    console.log('======================================================\n');
    installGlobalPlugin();
    initProjectScaffold();
    console.log('\n🎉 SETUP COMPLETE!');
    console.log('📌 Quick Start:');
    console.log('1. Open Antigravity on your phone -> Keep a single persistent thread with PM.');
    console.log('2. Open Codex on your phone -> Keep a single persistent thread for UX/UI / Architecture.');
    console.log('3. Agents synchronize automatically via .agents/STATE.json and Git (Web & Mobile)!\n');
    break;

  case 'watch':
    require('../scripts/watcher.js');
    break;
}
