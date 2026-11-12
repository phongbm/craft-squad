#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

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
  const allowedDirs = ['agents', 'assets', 'charters', 'mcp-server', 'rules', 'templates', 'bin'];
  const allowedFiles = ['plugin.json', 'package.json', 'squad.config.json', 'squad.schema.json', 'mcp_config.json'];

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

const pluginTargetDir = () => path.join(userHome, '.gemini', 'config', 'plugins', 'craft-squad');
const geminiConfigPath = () => path.join(userHome, '.gemini', 'config', 'config.json');

function writeJsonAtomic(filePath, data) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  let mode = 0o600;
  try { mode = fs.statSync(filePath).mode & 0o777; } catch (_) { /* new file: private by default */ }
  try {
    const fd = fs.openSync(tmpPath, 'wx', mode);
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2), null, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
    fs.chmodSync(tmpPath, mode);
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    fs.rmSync(tmpPath, { force: true });
    throw e;
  }
}

function readConfigJson(configPath) {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    throw new Error(`Could not read Antigravity configuration ${configPath}: ${e.message}`);
  }
}

function enableInConfigJson() {
  const configPath = geminiConfigPath();
  if (!fs.existsSync(configPath)) return;
  const cfg = readConfigJson(configPath);
  cfg.plugins = cfg.plugins || {};
  cfg.plugins['craft-squad'] = { ...cfg.plugins['craft-squad'], enabled: true };
  writeJsonAtomic(configPath, cfg);
  console.log('✅ Enabled craft-squad in Antigravity configuration.');
}

function removeFromConfigJson() {
  const configPath = geminiConfigPath();
  if (!fs.existsSync(configPath)) return;
  const cfg = readConfigJson(configPath);
  if (!cfg.plugins || !cfg.plugins['craft-squad']) return;
  delete cfg.plugins['craft-squad'];
  writeJsonAtomic(configPath, cfg);
  console.log('✅ Removed craft-squad from Antigravity configuration.');
}

const MCP_MARKER = '--craft-squad-mcp';

// Splits on whitespace outside quotes; backslashes stay literal so Windows paths survive.
function tokenizeCommandLine(line) {
  const tokens = [];
  let cur = '';
  let quote = null;
  let inToken = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null; else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      inToken = true;
    } else if (/\s/.test(ch)) {
      if (inToken) tokens.push(cur);
      cur = '';
      inToken = false;
    } else {
      cur += ch;
      inToken = true;
    }
  }
  if (inToken) tokens.push(cur);
  return tokens;
}

const NODE_BOOL_FLAGS = new Set(['--no-warnings', '--no-deprecation', '--trace-warnings', '--enable-source-maps', '--preserve-symlinks', '--preserve-symlinks-main', '--use-openssl-ca', '--use-system-ca']);
const NODE_VALUE_FLAGS = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '--conditions', '-C', '--env-file', '--max-old-space-size', '--stack-size', '--title']);

function isCraftSquadMcpCommand(cmdLine) {
  const tokens = tokenizeCommandLine(String(cmdLine || ''));
  if (tokens.length < 2 || !/^node(\.exe)?$/i.test(path.basename(tokens[0].replace(/\\/g, '/')))) return false;
  // Only the first positional is the entry point; anything after it belongs to that script.
  let script;
  let scriptIdx = -1;
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--') { scriptIdx = i + 1; script = tokens[scriptIdx]; break; }
    if (!t.startsWith('-')) { scriptIdx = i; script = t; break; }
    const eq = t.indexOf('=');
    const name = eq === -1 ? t : t.slice(0, eq);
    if (NODE_VALUE_FLAGS.has(name)) {
      if (eq === -1) {
        i++;
        if (i >= tokens.length) return false;
      }
    } else if (!NODE_BOOL_FLAGS.has(t)) {
      // Unknown flags (e.g. -e, --eval, --diagnostic-dir) may consume the next token, so the entry point can't be trusted.
      return false;
    }
  }
  if (!script || !/\.js$/i.test(script)) return false;
  const normalized = script.replace(/\\/g, '/').toLowerCase();
  if (normalized === 'mcp-server/index.js') return tokens.slice(scriptIdx + 1).includes(MCP_MARKER);
  return normalized.endsWith('/craft-squad/mcp-server/index.js');
}

// Lists processes and filters in JS so the lookup command's own text can never match.
function killRunningMcpServer(execFn = execSync) {
  if (process.env.CRAFTSQUAD_SKIP_MCP_KILL === '1') return;
  const win = process.platform === 'win32';
  try {
    const listCmd = win
      ? 'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"'
      : 'ps -eo pid=,args=';
    const out = String(execFn(listCmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }) || '');
    let procs;
    if (win) {
      const parsed = out.trim() ? JSON.parse(out) : [];
      procs = (Array.isArray(parsed) ? parsed : [parsed]).map((p) => ({ pid: Number(p.ProcessId), cmd: p.CommandLine }));
    } else {
      procs = out.split(/\r?\n/).map((l) => l.match(/^\s*(\d+)\s+(.*)$/)).filter(Boolean).map((m) => ({ pid: Number(m[1]), cmd: m[2] }));
    }
    for (const { pid, cmd } of procs) {
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid || !isCraftSquadMcpCommand(cmd)) continue;
      try {
        execFn(win ? `taskkill /PID ${pid} /F` : `kill ${pid}`, { stdio: 'ignore' });
      } catch (_) {
        // Process already exited
      }
    }
  } catch (_) {
    // Process listing unavailable; nothing to stop
  }
}

// unlinkSync removes symlinks and Windows junctions without touching their targets.
function removePluginDir(targetDir) {
  const stat = fs.lstatSync(targetDir);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(targetDir);
    return;
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
}

function isLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch (_) { return false; }
}

function pathExists(p) {
  try { fs.lstatSync(p); return true; } catch (_) { return false; }
}

function resolveForCompare(p) {
  let r;
  try { r = fs.realpathSync(p); } catch (_) { r = path.resolve(p); }
  return process.platform === 'win32' ? r.toLowerCase() : r;
}

function pathsOverlap(a, b) {
  return a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
}

function installGlobalPlugin({ enableConfig = enableInConfigJson } = {}) {
  const targetDir = pluginTargetDir();
  console.log(`
📦 Installing CraftSquad as Antigravity Global Plugin...`);
  console.log(`   Source: ${packageRootDir}`);
  console.log(`   Target: ${targetDir}
`);

  if (pathsOverlap(resolveForCompare(packageRootDir), resolveForCompare(targetDir))) {
    throw new Error(`Refusing to install: source (${packageRootDir}) and target (${targetDir}) are the same or overlap. Run install from the source repository, not from the installed directory.`);
  }

  // Fail on a malformed config before anything on disk is touched.
  if (fs.existsSync(geminiConfigPath())) readConfigJson(geminiConfigPath());

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  const stagingDir = `${targetDir}.staging-${process.pid}`;
  const backupDir = `${targetDir}.bak-${process.pid}`;
  fs.rmSync(stagingDir, { recursive: true, force: true });
  try {
    copyCleanPlugin(packageRootDir, stagingDir);
  } catch (e) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw e;
  }

  killRunningMcpServer();

  let movedAside = false;
  let placed = false;
  try {
    if (pathExists(backupDir)) removePluginDir(backupDir);
    if (pathExists(targetDir)) {
      fs.renameSync(targetDir, backupDir);
      movedAside = true;
    }
    fs.renameSync(stagingDir, targetDir);
    placed = true;
    enableConfig();
  } catch (e) {
    try {
      if (placed) removePluginDir(targetDir);
      if (movedAside) fs.renameSync(backupDir, targetDir);
    } catch (_) { /* backup stays on disk for manual recovery */ }
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw e;
  }
  if (movedAside) removePluginDir(backupDir);

  console.log(`✅ Clean plugin files deployed to: ${targetDir}`);
  console.log(`
🎉 CraftSquad Global Plugin ready! Check Plugins in Antigravity.
`);
}

function uninstallGlobalPlugin() {
  const targetDir = pluginTargetDir();
  console.log(`
🗑️ Uninstalling CraftSquad Global Plugin...`);
  console.log(`   Target: ${targetDir}
`);

  let present = true;
  try {
    fs.lstatSync(targetDir);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    present = false;
  }

  killRunningMcpServer();

  if (present) {
    try {
      removePluginDir(targetDir);
      console.log(`✅ Successfully removed plugin directory: ${targetDir}`);
    } catch (err) {
      console.error(`❌ Failed to remove ${targetDir}: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(`ℹ️ CraftSquad is not installed at ${targetDir}`);
  }

  removeFromConfigJson();
  if (present) console.log(`
🎉 CraftSquad Global Plugin uninstalled! Restart Antigravity to apply.
`);
}

function git(cwd, ...gitArgs) {
  return spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
}

// Returns true when a newer checkout was pulled and a fresh process performed the deploy.
function pullLatestAndRedeploy() {
  const repoRoot = path.resolve(packageRootDir, '..');
  const top = git(repoRoot, 'rev-parse', '--show-toplevel');
  const norm = (p) => path.resolve(p.trim()).toLowerCase();
  if (top.status !== 0 || norm(top.stdout) !== norm(repoRoot)) return false;
  if (git(repoRoot, 'remote', 'get-url', 'origin').status !== 0) return false;

  if (git(repoRoot, 'status', '--porcelain').stdout.trim()) {
    console.log('ℹ️ Local modifications detected; skipping git pull and deploying the local working tree.');
    return false;
  }

  const beforeSha = git(repoRoot, 'rev-parse', 'HEAD').stdout.trim();
  console.log('1. Pulling latest changes (git pull --ff-only)...');
  const pull = git(repoRoot, 'pull', '--ff-only');
  if (pull.status !== 0) {
    console.error(`❌ git pull failed: ${(pull.stderr || pull.stdout || '').trim()}`);
    console.error('   Pass --no-pull to deploy the current checkout without pulling.');
    process.exit(1);
  }
  const afterSha = git(repoRoot, 'rev-parse', 'HEAD').stdout.trim();
  if (beforeSha === afterSha) return false;

  console.log(`   Updated ${beforeSha.slice(0, 7)} -> ${afterSha.slice(0, 7)}; deploying with the new CLI...`);
  const reexecArgs = ['upgrade', '--no-pull'];
  const child = spawnSync(process.execPath, [path.join(packageRootDir, 'bin', 'cli.js'), ...reexecArgs], { stdio: 'inherit' });
  if (child.status !== 0) {
    if (child.error) console.error(`❌ Failed to launch upgraded CLI: ${child.error.message}`);
    if (child.signal) console.error(`❌ Upgraded CLI terminated by signal ${child.signal}`);
    process.exit(child.status || 1);
  }
  return true;
}

function upgradePlugin() {
  console.log(`
🔄 Upgrading CraftSquad Plugin...`);
  if (!args.includes('--no-pull') && pullLatestAndRedeploy()) {
    console.log(`
🎉 Upgrade complete!
`);
    return;
  }
  installGlobalPlugin();
  console.log(`
🎉 Upgrade complete! All templates, subagents, and configurations are up to date.
`);
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

  // 3. Templates
  const hasTemplates = fs.existsSync(path.join(packageRootDir, 'templates', 'craftsquad', 'epic-template.md'));
  if (hasTemplates) {
    console.log('  ✅ Templates: Ready (templates/craftsquad)');
  } else {
    console.log('  ⚠️ Templates: Missing templates/craftsquad. Reinstall the plugin.');
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

function printHelp() {
  console.log(`
CraftSquad CLI

Usage:
  craft-squad <command> [options]

Plugin Commands:
  install                  Deploy plugin to ~/.gemini/config/plugins/craft-squad
  update | upgrade         Pull latest commits (if git clone) and redeploy (--no-pull)
  uninstall                Stop CraftSquad MCP server, remove plugin dir, clean config.json
  status | doctor          Check Codex/Claude CLIs, plugin install state, and role mapping
  config                   Show active role-to-engine configuration
  config set <role> <engine> [model] [effort]
  init                     Create squad.config.json and squad.schema.json in current directory
  dispatch <role> [prompt] Run a single role dispatch (--dry, --epic=, --story=, --prompt-file=, --stdin)

Tool Commands (when run from repo or npm install):
  studio | tool            Launch local Web Studio at http://localhost:4200
  cx [args...]             Run account switcher: Codex (list, save, switch, rotate, sync, doctor) or "cx claude ..."
`);
}

function runSiblingTool(relScript, toolArgs = []) {
  const target = path.resolve(packageRootDir, '..', 'tool', relScript);
  if (!fs.existsSync(target)) {
    throw new Error(`Tool script not available in deployed plugin copy (${target}). Run from the cloned repo or via npx/npm install.`);
  }
  const res = spawnSync(process.execPath, [target, ...toolArgs], { stdio: 'inherit' });
  if (res.error) throw res.error;
  process.exit(res.status === null ? 1 : res.status);
}

function main() {
  switch (command) {
    case 'help':
    case '--help':
    case '-h': {
      printHelp();
      break;
    }

    case 'tool':
    case 'studio': {
      runGuarded(() => runSiblingTool('server.js'));
      break;
    }

    case 'cx': {
      runGuarded(() => runSiblingTool(path.join('bin', 'cx.js'), args.slice(1)));
      break;
    }

    case 'install':
    case 'install:global': {
      runGuarded(installGlobalPlugin);
      break;
    }

    case 'uninstall':
    case 'uninstall:global':
    case 'remove': {
      runGuarded(uninstallGlobalPlugin);
      break;
    }

    case 'upgrade':
    case 'update': {
      runGuarded(upgradePlugin);
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
      const epicPath = flagValue('epic');
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
            : ['--artifact', '--prompt-file', '--story', '--epic'].includes(name) && value !== undefined && value !== '';
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
          promptFile === '' || storyPath === '' || epicPath === '' ||
          bareFlag('prompt-file') || bareFlag('story') || bareFlag('epic') ||
          pos[1] === ''
        ) {
          console.error('Error: Empty input source path or empty prompt provided.');
          process.exit(1);
        }
        const explicitSources = [promptFile, storyPath, epicPath, useStdin, inlinePrompt].filter(Boolean).length;
        if (explicitSources > 1) {
          console.error('Error: Multiple input sources provided. Please specify only one of --prompt-file, --story, --epic, --stdin, or inline prompt.');
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
          } else if (epicPath) {
            const rawEpic = fs.readFileSync(path.resolve(cwd, epicPath), 'utf8');
            if (!rawEpic.trim()) throw new Error('Epic file is empty or contains only whitespace.');
            prompt = 'Implement/Execute the following Epic and all its contained Stories in a single batch according to role charter:\n\n' + rawEpic;
            inputSource = `epic: ${epicPath}`;
            target = epicPath;
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
          if (res.sources) console.log('Sources used:\n  - ' + res.sources.join('\n  - '));
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
}

function runGuarded(fn) {
  try {
    fn();
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { isCraftSquadMcpCommand, killRunningMcpServer, installGlobalPlugin, uninstallGlobalPlugin, upgradePlugin, removePluginDir, writeJsonAtomic, pullLatestAndRedeploy };
