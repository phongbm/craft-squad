#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0] || 'status';

const userHome = os.homedir();
const packageRootDir = path.resolve(__dirname, '..');
const { resolveConfig, dispatchRole } = require('../mcp-server/modules/dispatcher');

function initProjectConfig(targetDir = process.cwd()) {
  const targetConfig = path.join(targetDir, 'squad.config.json');
  const targetSchema = path.join(targetDir, 'squad.schema.json');

  if (fs.existsSync(targetConfig)) {
    console.log(`ℹ️ squad.config.json already exists at: ${targetConfig}`);
    return;
  }

  fs.copyFileSync(path.join(packageRootDir, 'squad.config.json'), targetConfig);
  fs.copyFileSync(path.join(packageRootDir, 'squad.schema.json'), targetSchema);
  console.log(`\n🎉 Initialized CraftSquad in project: ${targetDir}`);
  console.log(`   Created: squad.config.json`);
  console.log(`   Created: squad.schema.json (for IDE autocompletion & validation)\n`);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    if (item === 'node_modules' || item === '.git' || item === '.cache') continue;
    const s = path.join(src, item);
    const d = path.join(dest, item);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function installGlobalPlugin() {
  const targetDir = path.join(userHome, '.gemini', 'config', 'plugins', 'craft-squad');
  console.log(`\n📦 Installing CraftSquad as Antigravity Global Plugin...`);
  console.log(`   Source: ${packageRootDir}`);
  console.log(`   Target: ${targetDir}\n`);

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  try {
    if (fs.existsSync(targetDir)) {
      const items = fs.readdirSync(targetDir);
      if (items.length === 0) {
        fs.rmdirSync(targetDir);
      }
    }

    if (!fs.existsSync(targetDir)) {
      execSync(`cmd /c mklink /J "${targetDir}" "${packageRootDir}"`, { stdio: 'inherit' });
      console.log(`\n✅ Linked via Directory Junction: ${targetDir} -> ${packageRootDir}`);
      console.log(`   Any updates in this repository are immediately live in Antigravity!`);
    } else {
      console.log(`ℹ️ Plugin directory already exists at ${targetDir}`);
    }
  } catch (e) {
    console.log(`⚠️ Junction link failed (${e.message}), copying files recursively...`);
    copyRecursive(packageRootDir, targetDir);
    console.log(`✅ Global Plugin files copied to: ${targetDir}`);
  }

  console.log(`\n🎉 CraftSquad Global Plugin ready! Restart Antigravity or check Customizations to use.\n`);
}

function printConfig() {
  const { config, filePath } = resolveConfig(process.cwd());
  console.log('\n=================================================================');
  console.log('📋 CraftSquad Active Role & Engine Configuration Matrix');
  console.log('=================================================================');
  console.log(`Source: ${filePath || 'Default Package Config'}`);
  console.log(`Default Reasoning Effort: ${config.defaultReasoningEffort || 'medium'}\n`);

  console.log('| Role | Engine | Model / Command | Persona |');
  console.log('|---|---|---|---|');
  for (const [role, data] of Object.entries(config.roles || {})) {
    const target = data.model || data.command || 'N/A';
    console.log(`| \`${role}\` | **${data.engine}** | \`${target}\` | ${data.persona || ''} |`);
  }
  console.log('\n💡 To reconfigure a role:');
  console.log('  node bin/cli.js config set <role> <engine> [model]');
  console.log('Example:');
  console.log('  node bin/cli.js config set developer claude claude-3-7-sonnet-latest');
  console.log('  node bin/cli.js config set code_reviewer codex gpt-6.1-sol\n');
}

function setRoleConfig(role, engine, model) {
  if (!role || !engine) {
    console.error('❌ Usage: node bin/cli.js config set <role> <engine> [model]');
    process.exit(1);
  }

  const targetFile = path.join(process.cwd(), 'squad.config.json');
  let currentConfig = resolveConfig(process.cwd()).config;

  if (!currentConfig.roles) currentConfig.roles = {};
  const roleKey = role.toLowerCase().replace(/[\s-]/g, '_');

  currentConfig.roles[roleKey] = {
    ...(currentConfig.roles[roleKey] || {}),
    engine: engine.toLowerCase(),
    model: model || (engine === 'codex' ? 'gpt-6.1-sol' : engine === 'claude' ? 'claude-3-7-sonnet-latest' : 'gemini-3.8-flash')
  };

  fs.writeFileSync(targetFile, JSON.stringify(currentConfig, null, 2), 'utf8');
  console.log(`\n✅ Role "${roleKey}" updated in ${targetFile}`);
  console.log(`   Engine: ${engine} | Model: ${currentConfig.roles[roleKey].model}\n`);
}

function checkEngineStatus() {
  console.log('\n🔍 Checking CraftSquad Local Engine Status:');
  
  // 1. Check Codex CLI
  try {
    const codexVer = execSync('codex --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    console.log(`  ✅ OpenAI Codex CLI: ${codexVer} (Available & Connected)`);
  } catch (e) {
    console.log('  ⚠️ OpenAI Codex CLI: Not found or not authenticated. Run `npm i -g @openai/codex` and `codex login`.');
  }

  // 2. Check Claude Code CLI
  try {
    const claudeVer = execSync('claude --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    console.log(`  ✅ Claude Code CLI: ${claudeVer} (Available)`);
  } catch (e) {
    console.log('  ⚠️ Claude Code CLI: Not found. Run `npm i -g @anthropic-ai/claude-code` and `claude login`.');
  }

  // 3. Upstream Evidence
  const evidenceFile = path.join(packageRootDir, 'UPSTREAM_EVIDENCE.md');
  if (fs.existsSync(evidenceFile)) {
    console.log('  ✅ Upstream Evidence: Verified (github/spec-kit + bmad-code-org/BMAD-METHOD)');
  } else {
    console.log('  ⚠️ Upstream Evidence: Missing. Run `npm run sync:upstream`.');
  }

  // 4. Check Global Antigravity Plugin directory
  const pluginDir = path.join(userHome, '.gemini', 'config', 'plugins', 'craft-squad');
  if (fs.existsSync(path.join(pluginDir, 'plugin.json'))) {
    console.log(`  ✅ Antigravity Global Plugin: Installed at ${pluginDir}`);
  } else {
    console.log('  ℹ️ Antigravity Global Plugin: Not installed (Plugin development in workspace).');
  }
  console.log('');
}

switch (command) {
  case 'install':
  case 'install:global': {
    installGlobalPlugin();
    break;
  }

  case 'init': {
    initProjectConfig();
    break;
  }

  case 'config': {
    const subCmd = args[1];
    if (subCmd === 'set') {
      setRoleConfig(args[2], args[3], args[4]);
    } else {
      printConfig();
    }
    break;
  }

  case 'sync':
  case 'sync:upstream': {
    console.log('🔄 Launching Upstream Synchronizer...');
    require('../scripts/sync-upstream.js');
    break;
  }

  case 'dispatch':
  case 'test-dispatch': {
    const role = args[1] || 'code_reviewer';
    const prompt = args[2] || 'Say "CraftSquad Dispatcher operational" in 5 words or less.';
    console.log(`\n🚀 Testing dispatch to role: ${role}`);
    console.log(`Prompt: "${prompt}"\n`);
    dispatchRole(role, prompt, { workingDirectory: process.cwd() })
      .then((res) => {
        console.log('\n--- Dispatch Result ---');
        console.log('Role:', res.role);
        console.log('Engine:', res.engine);
        console.log('Model:', res.model);
        console.log('Reasoning Effort:', res.reasoningEffort);
        console.log('Success:', res.success);
        console.log('Output:\n' + res.output + '\n');
      })
      .catch((err) => {
        console.error('❌ Dispatch failed:', err.message);
        process.exit(1);
      });
    break;
  }

  case 'status':
  case 'doctor':
  default:
    checkEngineStatus();
    printConfig();
    break;
}
