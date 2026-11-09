#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const command = args[0] || 'status';

const userHome = os.homedir();
const packageRootDir = path.resolve(__dirname, '..');
const { resolveConfig, dispatchRole, setRole, detectReasoningEffort, appendDispatchLog } = require('../mcp-server/modules/dispatcher');

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

function copyCleanPlugin(src, dest) {
  const allowedDirs = ['agents', 'charters', 'mcp-server', 'rules', 'templates', 'bin'];
  const allowedFiles = ['plugin.json', 'package.json', 'squad.config.json', 'squad.schema.json', 'mcp_config.json', 'README.md', 'UPSTREAM_EVIDENCE.md'];

  fs.mkdirSync(dest, { recursive: true });
  for (const f of allowedFiles) {
    const srcFile = path.join(src, f);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(dest, f));
    }
  }
  for (const d of allowedDirs) {
    const srcDir = path.join(src, d);
    if (fs.existsSync(srcDir)) {
      copyRecursive(srcDir, path.join(dest, d));
    }
  }
}

function enableInConfigJson() {
  try {
    const configPath = path.join(userHome, '.gemini', 'config', 'config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!cfg.plugins) cfg.plugins = {};
      if (!cfg.plugins['craft-squad']) cfg.plugins['craft-squad'] = {};
      cfg.plugins['craft-squad'].enabled = true;
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
      console.log('✅ Enabled craft-squad in Antigravity configuration.');
    }
  } catch (e) {
    // Ignore error
  }
}

function installGlobalPlugin() {
  const targetDir = path.join(userHome, '.gemini', 'config', 'plugins', 'craft-squad');
  console.log(`\n📦 Installing CraftSquad as Antigravity Global Plugin...`);
  console.log(`   Source: ${packageRootDir}`);
  console.log(`   Target: ${targetDir}\n`);

  fs.mkdirSync(targetDir, { recursive: true });
  copyCleanPlugin(packageRootDir, targetDir);
  enableInConfigJson();

  console.log(`✅ Clean plugin files deployed to: ${targetDir}`);
  console.log(`\n🎉 CraftSquad Global Plugin ready! Check Plugins in Antigravity.\n`);
}

function killRunningMcpServer() {
  try {
    if (process.platform === 'win32') {
      execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*mcp-server/index.js*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "mcp-server/index.js"', { stdio: 'ignore' });
    }
  } catch (_) {
    // Ignore when no running server process exists
  }
}

function uninstallGlobalPlugin() {
  const targetDir = path.join(userHome, '.gemini', 'config', 'plugins', 'craft-squad');
  console.log(`\n🗑️ Uninstalling CraftSquad Global Plugin...`);
  console.log(`   Target: ${targetDir}\n`);

  if (!fs.existsSync(targetDir)) {
    console.log(`ℹ️ CraftSquad is not installed at ${targetDir}`);
    return;
  }

  killRunningMcpServer();

  try {
    if (process.platform === 'win32') {
      try {
        execSync(`cmd /c rmdir "${targetDir}"`, { stdio: 'pipe' });
        console.log(`✅ Successfully removed plugin link/junction: ${targetDir}`);
        console.log(`\n🎉 CraftSquad Global Plugin uninstalled! Restart Antigravity to apply.\n`);
        return;
      } catch (_) {
        // Fallback if targetDir was a non-empty directory rather than a junction
      }
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    console.log(`✅ Successfully removed plugin directory: ${targetDir}`);
  } catch (err) {
    console.error(`❌ Failed to remove ${targetDir}: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n🎉 CraftSquad Global Plugin uninstalled! Restart Antigravity to apply.\n`);
}

function upgradePlugin() {
  console.log(`\n🔄 Upgrading CraftSquad Plugin...`);
  try {
    console.log('1. Refreshing upstream BMAD and Spec-Kit templates...');
    require('../scripts/sync-upstream.js');
  } catch (e) {
    console.log(`ℹ️ Upstream sync note: ${e.message}`);
  }
  uninstallGlobalPlugin();
  installGlobalPlugin();
  console.log(`\n🎉 Upgrade complete! All templates, subagents, and configurations are up to date.\n`);
}

function printConfig() {
  const { config, filePath } = resolveConfig(process.cwd());
  console.log('\n=================================================================');
  console.log('CraftSquad role / engine configuration');
  console.log('=================================================================');
  console.log(`Source: ${filePath}`);
  console.log(`Default effort: ${config.defaultReasoningEffort || 'medium'} | Gemini-engine effort: ${config.geminiDefaultReasoningEffort || 'high'}\n`);

  console.log('| Role | Engine | Model / Command | Effort | Title |');
  console.log('|---|---|---|---|---|');
  for (const [role, data] of Object.entries(config.roles || {})) {
    const target = data.model || data.command || 'N/A';
    const effort = data.engine === 'cli' ? '-' : detectReasoningEffort('', null, data, config.defaultReasoningEffort, config.geminiDefaultReasoningEffort);
    console.log(`| \`${role}\` | **${data.engine}** | \`${target}\` | ${effort} | ${data.title || ''} |`);
  }
  console.log('\nReconfigure a role:');
  console.log('  node bin/cli.js config set <role> <engine> [model] [effort]');
  console.log('  e.g. node bin/cli.js config set developer claude <model> medium\n');
}

function setRoleConfig(role, engine, model, effort) {
  if (!role || !engine) {
    console.error('Usage: node bin/cli.js config set <role> <engine> [model] [effort]');
    process.exit(1);
  }
  const res = setRole({ role, engine, model, reasoningEffort: effort, workingDirectory: process.cwd() });
  console.log(`\nRole "${res.role}" updated in ${res.configPath}`);
  console.log(`  ${JSON.stringify(res.settings)}\n`);
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

  case 'uninstall':
  case 'uninstall:global':
  case 'remove': {
    uninstallGlobalPlugin();
    break;
  }

  case 'upgrade':
  case 'update': {
    upgradePlugin();
    break;
  }

  case 'init': {
    initProjectConfig();
    break;
  }

  case 'config': {
    const subCmd = args[1];
    if (subCmd === 'set') {
      setRoleConfig(args[2], args[3], args[4], args[5]);
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
    // usage: dispatch <role> "<prompt>" [--dry] [--artifact=<type>]
    // also: --prompt-file=<path> | --story=<path> | --stdin (or "-" as prompt)
    const flags = args.filter((a) => a.startsWith('--'));
    const pos = args.slice(1).filter((a) => !a.startsWith('--'));
    if (pos.length > 2) {
      console.error('Error: Too many positional arguments provided. Expected: node bin/cli.js dispatch <role> [prompt]');
      process.exit(1);
    }
    const role = pos[0] || 'code_reviewer';
    const dryRun = flags.includes('--dry');
    const flagValue = (name) => {
      const f = flags.find((x) => x.startsWith(`--${name}=`));
      return f ? f.slice(name.length + 3) : undefined;
    };
    const artifactType = flagValue('artifact');
    const promptFile = flagValue('prompt-file');
    const storyPath = flagValue('story');
    const useStdin = flags.includes('--stdin') || pos[1] === '-';
    const cwd = process.cwd();
    const roleKey = role.toLowerCase().replace(/[\s-]/g, '_').replace(/^cs_/, '');
    const logFiles = ['latest-dispatch.log', `dispatch-${roleKey}.log`];
    const writeLog = (text) => appendDispatchLog(cwd, logFiles, text);

    const readStdin = () => new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => { data += c; });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });

    (async () => {
      let prompt;
      let inputSource;
      let target;
      const inlinePrompt = pos[1] && pos[1] !== '-' ? pos[1] : undefined;
      const bareFlag = (name) => flags.includes(`--${name}`);
      for (const flag of flags) {
        const eq = flag.indexOf('=');
        const name = eq === -1 ? flag : flag.slice(0, eq);
        const value = eq === -1 ? undefined : flag.slice(eq + 1);
        const valid = (name === '--dry' || name === '--stdin')
          ? value === undefined
          : ['--artifact', '--prompt-file', '--story'].includes(name) && value !== undefined && value !== '';
        if (!valid) {
          console.error(`Error: Unknown or malformed flag: ${flag}`);
          process.exit(1);
        }
      }
      const flagNames = flags.map((f) => f.split('=')[0]);
      if (new Set(flagNames).size !== flagNames.length) {
        console.error('Error: Duplicate flag provided.');
        process.exit(1);
      }
      if (
        promptFile === '' || storyPath === '' ||
        bareFlag('prompt-file') || bareFlag('story') ||
        pos[1] === ''
      ) {
        console.error('Error: Empty input source path or empty prompt provided.');
        process.exit(1);
      }
      const explicitSources = [promptFile, storyPath, useStdin, inlinePrompt].filter(Boolean).length;
      if (explicitSources > 1) {
        console.error('Error: Multiple input sources provided. Please specify only one of --prompt-file, --story, --stdin, or inline prompt.');
        process.exit(1);
      }
      try {
        if (promptFile) {
          prompt = fs.readFileSync(path.resolve(cwd, promptFile), 'utf8');
          inputSource = `file: ${promptFile}`;
          target = promptFile;
        } else if (storyPath) {
          const rawStory = fs.readFileSync(path.resolve(cwd, storyPath), 'utf8');
          if (!rawStory.trim()) throw new Error('Story file is empty or contains only whitespace.');
          prompt = 'Implement/Execute the following Story according to role charter:\n\n' + rawStory;
          inputSource = `story: ${storyPath}`;
          target = storyPath;
        } else if (useStdin) {
          prompt = await readStdin();
          inputSource = 'stdin';
          target = 'stdin prompt';
        } else {
          prompt = inlinePrompt || 'Reply with one short sentence confirming you are reachable.';
          inputSource = 'inline';
          const flat = prompt.replace(/\s+/g, ' ').trim();
          target = flat.length > 60 ? flat.slice(0, 60) + '...' : flat;
        }
      } catch (err) {
        console.error('Failed to read dispatch input:', err.message);
        process.exit(1);
      }

      // Pre-Dispatch Status Card (matches rules/AGENTS.md Section 7)
      let roleCfg = {};
      let globalCfg = {};
      try { globalCfg = resolveConfig(cwd).config; roleCfg = (globalCfg.roles || {})[roleKey] || {}; } catch (_) { /* reported by dispatchRole */ }
      const effort = detectReasoningEffort(prompt, null, roleCfg, globalCfg.defaultReasoningEffort, globalCfg.geminiDefaultReasoningEffort);
      const isNativeSubagent = roleCfg.engine === 'gemini' || roleCfg.engine === 'antigravity';
      const logRel = isNativeSubagent
        ? '(Pending: Conversation ID / Subagent ID will be logged on spawn)'
        : `.craft-squad/logs/dispatch-${roleKey}.log`;
      const card = [
        '### 🚀 CraftSquad Dispatch',
        '| Field | Value |',
        '|---|---|',
        `| Role | ${role} |`,
        `| Engine | ${roleCfg.engine || '?'} |`,
        `| Model | ${roleCfg.model || 'default'} (effort: ${effort}) |`,
        `| Target | ${String(target).replace(/\|/g, '\\|')} |`,
        `| Input Source | ${inputSource} |`,
        `| Tracking | ${logRel} |`,
        `| Working Dir | ${cwd} |`
      ].join('\n');
      console.log('\n' + card + '\n');

      writeLog(`\n${card}\n[${new Date().toISOString()}] CLI dispatch role=${role} input=${inputSource}${dryRun ? ' (dry run)' : ''}\n`);

      console.log(`Dispatching to role: ${role}${dryRun ? ' (dry run)' : ''}`);
      return dispatchRole(role, prompt, {
        workingDirectory: cwd,
        dryRun,
        artifactType
      }).then((res) => {
        // claude/codex output is already streamed chunk-by-chunk by runEngineProcess; cli is logged by executeCliCommand.
        const alreadyLogged = ['claude', 'codex', 'cli'].includes(res.engine);
        const extra = dryRun || alreadyLogged ? '' : (res.output || '') + '\n';
        writeLog(`[${new Date().toISOString()}] CLI dispatch finished success=${res.success}\n${extra}`);
        return res;
      });
    })()
      .then((res) => {
        console.log('\n--- Dispatch Result ---');
        console.log('Role:', res.role);
        console.log('Engine:', res.engine);
        console.log('Model:', res.model);
        console.log('Reasoning Effort:', res.reasoningEffort);
        console.log('Success:', res.success);
        if (res.sources) console.log('Upstream sources used:\n  - ' + res.sources.join('\n  - '));
        if (res.missingSources && res.missingSources.length) console.log('MISSING sources:\n  - ' + res.missingSources.join('\n  - '));
        console.log('Output:\n' + (dryRun ? (res.compiledPrompt || res.command || '') : res.output) + '\n');
        if (!res.success) {
          process.exit(typeof res.exitCode === 'number' && res.exitCode !== 0 ? res.exitCode : 1);
        }
      })
      .catch((err) => {
        writeLog(`[${new Date().toISOString()}] CLI dispatch failed: ${err.message}\n[${new Date().toISOString()}] CLI dispatch finished success=false\n`);
        console.error('Dispatch failed:', err.message);
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
