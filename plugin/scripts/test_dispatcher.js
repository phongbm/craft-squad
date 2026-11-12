/**
 * CraftSquad tests. Offline: nothing here launches Codex/Claude (dryRun only).
 * Run: npm run test:dispatcher
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { resolveConfig, detectReasoningEffort, dispatchRole, setRole, executeCliCommand } = require('../mcp-server/modules/dispatcher');
const { compileRolePrompt, ROLE_SOURCES } = require('../mcp-server/modules/prompt-compiler');

// Keep every cx child process away from the real ~/.codex and ~/.craft-squad.
const cxSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-cxsandbox-'));
process.env.CODEX_HOME = path.join(cxSandbox, 'codex');
process.env.CX_CODEX_HOME = path.join(cxSandbox, 'codex-profiles');
process.env.CX_CLAUDE_HOME = path.join(cxSandbox, 'claude-profiles');

const root = path.resolve(__dirname, '..');
let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n  ${e.message}`); process.exitCode = 1; }
};

(async () => {
  const { config } = resolveConfig(root);
  const roleIds = Object.keys(config.roles);

  await test('config defines all 9 roles and schema role ids', () => {
    const expected = ['spec_owner', 'scrum_master', 'architect', 'ui_designer', 'developer', 'code_reviewer', 'tester', 'rescue', 'qa_gatekeeper'];
    expected.forEach((r) => assert(config.roles[r], `missing role ${r}`));
    const schema = JSON.parse(fs.readFileSync(path.join(root, 'squad.schema.json'), 'utf8'));
    expected.forEach((r) => assert(schema.properties.roles.properties[r], `schema missing ${r}`));
    Object.values(config.roles).forEach((r) => assert(['gemini', 'codex', 'claude', 'cli'].includes(r.engine)));
  });

  await test('agents/rules contain no model names or hardcoded engine ids', () => {
    const banned = /gpt-\d|sonnet|gemini-\d|astra|claude-\d|opus|haiku/i;
    const files = [path.join(root, 'rules', 'AGENTS.md')];
    if (fs.existsSync(path.join(root, 'agents'))) {
      for (const f of fs.readdirSync(path.join(root, 'agents'))) files.push(path.join(root, 'agents', f));
    }
    for (const f of fs.readdirSync(path.join(root, 'charters'))) files.push(path.join(root, 'charters', f));
    files.forEach((f) => assert(!banned.test(fs.readFileSync(f, 'utf8')), `model name found in ${path.relative(root, f)}`));
  });

  await test('every role has a charter and a native subagent; no skills remain', () => {
    assert(!fs.existsSync(path.join(root, 'skills')), 'skills/ directory still exists, should be fully replaced by agents/');
    roleIds.forEach((r) => assert(fs.existsSync(path.join(root, 'charters', `${r}.md`)), `charter missing: ${r}`));
    const agents = fs.readdirSync(path.join(root, 'agents'));
    const expectedAgents = [
      'cs-spec-owner.md',
      'cs-scrum-master.md',
      'cs-architect.md',
      'cs-ui-designer.md',
      'cs-developer.md',
      'cs-code-reviewer.md',
      'cs-tester.md',
      'cs-rescue.md'
    ];
    expectedAgents.forEach((a) => assert(agents.includes(a), `native subagent manifest missing: ${a}`));
  });

  await test('reasoning effort rules', () => {
    const g = config.roles.tester;
    const d = config.roles.developer;
    const ge = config.geminiDefaultReasoningEffort;
    const de = config.defaultReasoningEffort;
    assert.strictEqual(detectReasoningEffort('x', null, { engine: 'gemini' }, de, ge), ge);
    assert.strictEqual(detectReasoningEffort('x', null, { engine: 'claude' }, de, ge), de);
    assert.strictEqual(detectReasoningEffort('x [effort: low]', null, g, de, ge), 'low');
    assert.strictEqual(detectReasoningEffort('x [effort: xhigh]', 'low', d, de, ge), 'xhigh');
    assert.strictEqual(detectReasoningEffort('x', 'high', d, de, ge), 'high');
  });

  await test('every charter carries a Persona section with identity, style and principles', () => {
    for (const role of Object.keys(ROLE_SOURCES)) {
      const c = fs.readFileSync(path.join(root, 'charters', `${role}.md`), 'utf8');
      assert(/## Persona/.test(c), `${role} charter lacks a Persona section`);
      assert(c.includes('**Identity:**') && c.includes('**Style:**') && c.includes('**Principles:**'), `${role} persona incomplete`);
    }
  });

  await test('compiler reads every declared source from disk (none missing)', () => {
    for (const role of Object.keys(ROLE_SOURCES)) {
      const types = Object.keys(ROLE_SOURCES[role].artifacts);
      for (const t of types.length ? types : [undefined]) {
        const r = compileRolePrompt(role, 'TASK', { artifactType: t });
        assert.deepStrictEqual(r.missing, [], `${role}/${t} missing: ${r.missing.join(', ')}`);
        assert(r.prompt.includes('TASK'));
      }
    }
  });

  await test('compiled prompts embed charters, lenses and templates', () => {
    const arch = compileRolePrompt('architect', 'T', { artifactType: 'plan' });
    assert(/Module Boundaries/.test(arch.prompt) && /## Persona/.test(arch.prompt));
    const spec = compileRolePrompt('spec_owner', 'T', { artifactType: 'spec' });
    assert(/Functional Requirements/.test(spec.prompt) && /NEEDS CLARIFICATION/.test(spec.prompt));
    const rev = compileRolePrompt('code_reviewer', 'T');
    assert(/Edge Case Hunter/.test(rev.prompt) && /Verification Gap/.test(rev.prompt) && /Adversarial Review/.test(rev.prompt));
    const tasks = compileRolePrompt('scrum_master', 'T', { artifactType: 'tasks' });
    assert(/Phase 1/.test(tasks.prompt) && tasks.prompt.includes('[P]'));
    const bug = compileRolePrompt('scrum_master', 'T', { artifactType: 'bug' });
    assert(/Reproduction/.test(bug.prompt));
    const epic = compileRolePrompt('spec_owner', 'T', { artifactType: 'epic' });
    assert(/Scope Boundaries/.test(epic.prompt));
    const story = compileRolePrompt('scrum_master', 'T', { artifactType: 'story' });
    assert(/ACCEPTANCE CRITERIA/.test(story.prompt));
  });

  await test('tester and scrum_master compiled prompts mirror agent manifests', () => {
    const t = compileRolePrompt('tester', 'T').prompt;
    assert(/Universal Runtime Introspection/.test(t) && /Environment Precondition/.test(t));
    assert(!/React|Vietnamese/i.test(fs.readFileSync(path.join(root, 'charters', 'tester.md'), 'utf8')));
    const sm = compileRolePrompt('scrum_master', 'T').prompt;
    assert(/Zero-Computation Discipline/.test(sm) && /Instant Triage Protocol/.test(sm) && /Pre-Dispatch Status Card/.test(sm));
  });

  await test('executeCliCommand streams output to the log while running', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    const cmd = 'node -e "console.log(\'STREAM-EARLY\');setTimeout(()=>{},2500)"';
    fs.writeFileSync(path.join(tmp, 'squad.config.json'), JSON.stringify({ ...config, roles: { qa_gatekeeper: { engine: 'cli', command: cmd } } }));
    const p = dispatchRole('qa_gatekeeper', 'x', { workingDirectory: tmp });
    const logFile = path.join(tmp, '.craft-squad', 'logs', 'dispatch-qa_gatekeeper.log');
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) {
      await new Promise((r) => setTimeout(r, 100));
      seen = fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes('STREAM-EARLY');
    }
    const r = await Promise.race([p, new Promise((res) => setTimeout(() => res(null), 0))]);
    assert(seen && r === null, 'output should be logged before the command finishes');
    assert.strictEqual((await p).success, true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('executeCliCommand preserves multibyte UTF-8 split across chunks', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    // "Tiếng Việt có dấu: đang thẩm định" (escaped so the source stays ASCII-safe)
    const text = 'Tiếng Việt có dấu: đang thẩm định';
    const script = path.join(tmp, 'emit.js');
    // Write the bytes in 1-byte chunks so multibyte characters are split across 'data' events.
    fs.writeFileSync(script, `const b=Buffer.from(${JSON.stringify(text)},'utf8');let i=0;(function n(){if(i<b.length){process.stdout.write(b.subarray(i,i+1));i++;setTimeout(n,2);}})();`);
    const r = await executeCliCommand({ command: `node "${script}"`, cwd: tmp, timeoutSeconds: 30, role: 'utf8' });
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.output, text);
    assert(!r.output.includes('�'), 'output contains replacement characters');
    const log = fs.readFileSync(path.join(tmp, '.craft-squad', 'logs', 'dispatch-utf8.log'), 'utf8');
    assert(log.includes(text), 'log should contain intact text');
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('every role has a native subagent definition in agents/', () => {
    const subagents = ['cs-spec-owner', 'cs-scrum-master', 'cs-architect', 'cs-ui-designer', 'cs-developer', 'cs-code-reviewer', 'cs-tester', 'cs-rescue'];
    subagents.forEach((s) => {
      const p = path.join(root, 'agents', `${s}.md`);
      assert(fs.existsSync(p), `subagent missing: ${s}`);
      const content = fs.readFileSync(p, 'utf8');
      assert(/subagent:\s*true/i.test(content), `subagent flag missing in ${s}`);
    });
  });

  await test('plugin ships no third-party BMAD/Spec-Kit templates or sync tooling', () => {
    assert(!fs.existsSync(path.join(root, 'templates', 'bmad')));
    assert(!fs.existsSync(path.join(root, 'templates', 'speckit')));
    assert(!fs.existsSync(path.join(root, 'scripts', 'sync-upstream.js')));
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'scripts' ? [] : walk(p);
      return [p];
    });
    for (const f of walk(root).filter((p) => /\.(md|json|js|toml)$/.test(p))) {
      assert(!/bmad|spec-?kit/i.test(fs.readFileSync(f, 'utf8')), `stale upstream reference in ${path.relative(root, f)}`);
    }
  });

  await test('unknown artifactType is rejected', () => {
    assert.throws(() => compileRolePrompt('architect', 'T', { artifactType: 'nope' }), /Unknown artifactType/);
  });

  await test('dispatch (dry) resolves routing from config for every role', async () => {
    for (const role of roleIds) {
      const r = await dispatchRole(role, 'check', { dryRun: true, workingDirectory: root });
      assert.strictEqual(r.engine, config.roles[role].engine);
      assert.strictEqual(r.model, config.roles[role].model);
      if (r.engine !== 'cli') assert(r.compiledPrompt && r.sources.length > 0, `${role} compiled nothing`);
    }
  });

  await test('changing config changes routing without touching subagents or rules', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    fs.writeFileSync(path.join(tmp, 'squad.config.json'), JSON.stringify(config));
    setRole({ role: 'developer', engine: 'codex', model: 'custom-model-x', reasoningEffort: 'high', workingDirectory: tmp });
    const r = await dispatchRole('developer', 'check', { dryRun: true, workingDirectory: tmp });
    assert.strictEqual(r.engine, 'codex');
    assert.strictEqual(r.model, 'custom-model-x');
    assert.strictEqual(r.reasoningEffort, 'high');
    setRole({ role: 'developer', engine: 'claude', workingDirectory: tmp });
    const r2 = await dispatchRole('developer', 'check', { dryRun: true, workingDirectory: tmp });
    assert.strictEqual(r2.model, config.engineDefaults.claude);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('unknown role is rejected with available roles', async () => {
    await assert.rejects(() => dispatchRole('nobody', 'x', { dryRun: true, workingDirectory: root }), /not defined/);
  });

  await test('normalizeRole accepts cs-prefixed and kebab-case role names', async () => {
    const dev = await dispatchRole('cs-developer', 'check', { dryRun: true, workingDirectory: root });
    assert.strictEqual(dev.role, 'developer');
    const rev = await dispatchRole('cs_code_reviewer', 'check', { dryRun: true, workingDirectory: root });
    assert.strictEqual(rev.role, 'code_reviewer');
  });

  await test('qa_gatekeeper reports real exit codes', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    const mk = (cmd) => fs.writeFileSync(path.join(tmp, 'squad.config.json'), JSON.stringify({ ...config, roles: { qa_gatekeeper: { engine: 'cli', command: cmd } } }));
    mk('node -e "process.exit(0)"');
    const ok = await dispatchRole('qa_gatekeeper', 'x', { workingDirectory: tmp });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(ok.exitCode, 0);
    mk('node -e "process.exit(3)"');
    const bad = await dispatchRole('qa_gatekeeper', 'x', { workingDirectory: tmp });
    assert.strictEqual(bad.success, false);
    assert.strictEqual(bad.exitCode, 3);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('promptFile, storyPath, and epicPath are loaded by dispatchRole', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    fs.writeFileSync(path.join(tmp, 'p.txt'), 'PROMPT-FILE-MARKER');
    fs.writeFileSync(path.join(tmp, 'story.md'), '# Story\nSTORY-MARKER');
    fs.writeFileSync(path.join(tmp, 'epic.md'), '# Epic\nEPIC-MARKER');
    const a = await dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, promptFile: 'p.txt' });
    assert(a.compiledPrompt.includes('PROMPT-FILE-MARKER'));
    const b = await dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, storyPath: 'story.md' });
    assert(b.compiledPrompt.includes('STORY-MARKER'));
    assert(b.compiledPrompt.includes('Implement/Execute the following Story'));
    const c = await dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, epicPath: 'epic.md' });
    assert(c.compiledPrompt.includes('EPIC-MARKER'));
    assert(c.compiledPrompt.includes('Implement/Execute the following Epic and all its contained Stories in a single batch'));
    await assert.rejects(() => dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, promptFile: 'missing.txt' }));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('empty or whitespace-only story and epic files are rejected', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    fs.writeFileSync(path.join(tmp, 'empty.md'), '');
    fs.writeFileSync(path.join(tmp, 'ws.md'), '  \n\t\n');
    const msgStory = /Story file is empty or contains only whitespace/;
    await assert.rejects(() => dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, storyPath: 'empty.md' }), msgStory);
    await assert.rejects(() => dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, storyPath: 'ws.md' }), msgStory);
    const msgEpic = /Epic file is empty or contains only whitespace/;
    await assert.rejects(() => dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, epicPath: 'empty.md' }), msgEpic);
    await assert.rejects(() => dispatchRole('developer', '', { dryRun: true, workingDirectory: tmp, epicPath: 'ws.md' }), msgEpic);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('executeCliCommand writes dispatch-<role>.log and latest-dispatch.log', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    fs.writeFileSync(path.join(tmp, 'squad.config.json'), JSON.stringify({ ...config, roles: { qa_gatekeeper: { engine: 'cli', command: 'node -e "console.log(\'GATE-OUT\')"' } } }));
    const r = await dispatchRole('qa_gatekeeper', 'x', { workingDirectory: tmp });
    assert.strictEqual(r.success, true);
    const logs = path.join(tmp, '.craft-squad', 'logs');
    const roleLog = fs.readFileSync(path.join(logs, 'dispatch-qa_gatekeeper.log'), 'utf8');
    const latest = fs.readFileSync(path.join(logs, 'latest-dispatch.log'), 'utf8');
    [roleLog, latest].forEach((l) => {
      assert(l.includes('GATE-OUT'), 'log missing command output');
      assert(/dispatch start/.test(l) && /dispatch end/.test(l), 'log missing start/end markers');
    });
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  await test('empty or whitespace-only prompt is rejected', async () => {
    const msg = /A non-empty prompt, promptFile, storyPath, or epicPath is required to dispatch role "developer"/;
    await assert.rejects(() => dispatchRole('developer', '', { dryRun: true, workingDirectory: root }), msg);
    await assert.rejects(() => dispatchRole('developer', '   \n\t', { dryRun: true, workingDirectory: root }), msg);
    await assert.rejects(() => dispatchRole('developer', undefined, { dryRun: true, workingDirectory: root }), msg);
  });

  await test('dispatch writes dispatch-<role>.log and latest-dispatch.log', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-bin-'));
    // Fake `claude` CLI: echoes stdin size so no real engine is launched.
    const shim = path.join(bin, 'claude.js');
    fs.writeFileSync(shim, "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('FAKE-CLAUDE-OUT '+d.length));");
    if (process.platform === 'win32') {
      fs.writeFileSync(path.join(bin, 'claude.cmd'), `@echo off\r\nnode "${shim}" %*\r\n`);
    } else {
      fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\nexec node "${shim}" "$@"\n`);
      fs.chmodSync(path.join(bin, 'claude'), 0o755);
    }
    fs.writeFileSync(path.join(tmp, 'squad.config.json'), JSON.stringify({ ...config, roles: { developer: { engine: 'claude', model: 'sonnet' } } }));
    const oldPath = process.env.PATH;
    process.env.PATH = bin + path.delimiter + oldPath;
    try {
      const r = await dispatchRole('cs-developer', 'do the thing', { workingDirectory: tmp, timeoutSeconds: 60 });
      assert.strictEqual(r.success, true, r.output);
      assert.strictEqual(r.metadata.role, 'developer');
      const logs = path.join(tmp, '.craft-squad', 'logs');
      const roleLog = fs.readFileSync(path.join(logs, 'dispatch-developer.log'), 'utf8');
      const latest = fs.readFileSync(path.join(logs, 'latest-dispatch.log'), 'utf8');
      assert(roleLog.includes('FAKE-CLAUDE-OUT'), 'role log missing live output');
      assert(latest.includes('FAKE-CLAUDE-OUT'), 'latest log missing live output');
      assert(!fs.existsSync(path.join(logs, 'dispatch-claude.log')), 'should be keyed by role, not engine');
    } finally {
      process.env.PATH = oldPath;
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  await test('dispatchRole rejects conflicting or empty promptFile/storyPath/epicPath options', async () => {
    const o = { dryRun: true, workingDirectory: root };
    await assert.rejects(() => dispatchRole('developer', '', { ...o, promptFile: 'a', storyPath: 'b' }), /Cannot specify more than one of promptFile, storyPath, or epicPath/);
    await assert.rejects(() => dispatchRole('developer', '', { ...o, promptFile: 'a', epicPath: 'b' }), /Cannot specify more than one of promptFile, storyPath, or epicPath/);
    await assert.rejects(() => dispatchRole('developer', '', { ...o, promptFile: '  ' }), /Invalid empty promptFile/);
    await assert.rejects(() => dispatchRole('developer', '', { ...o, storyPath: '' }), /Invalid empty storyPath/);
    await assert.rejects(() => dispatchRole('developer', '', { ...o, epicPath: '  ' }), /Invalid empty epicPath/);
  });

  await test('CLI dispatch rejects invalid input with exit code 1', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const run = (...a) => spawnSync(process.execPath, [cli, 'dispatch', ...a], { cwd: root, encoding: 'utf8', timeout: 30000 });
    const empty = run('developer', '');
    assert.strictEqual(empty.status, 1, empty.stderr);
    assert(/Empty input/.test(empty.stderr));
    const conflict = run('developer', '--story=a.md', '--prompt-file=b.md');
    assert.strictEqual(conflict.status, 1, conflict.stderr);
    assert(/Multiple input sources/.test(conflict.stderr));
    const dup = run('developer', '--story=a.md', '--story=b.md');
    assert.strictEqual(dup.status, 1, dup.stderr);
    assert(/Duplicate flag provided/.test(dup.stderr));
  });

  await test('CLI dispatch rejects extra positional arguments with exit code 1', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const r = spawnSync(process.execPath, [cli, 'dispatch', 'developer', 'x', 'extra'], { cwd: root, encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(r.status, 1, r.stderr);
    assert(r.stderr.includes('Error: Too many positional arguments provided. Expected: node bin/cli.js dispatch <role> [prompt]'), r.stderr);
  });

  await test('CLI dispatch rejects unknown or malformed flags with exit code 1', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const run = (...a) => spawnSync(process.execPath, [cli, 'dispatch', ...a], { cwd: root, encoding: 'utf8', timeout: 30000 });
    for (const bad of ['--stdin=ignored', '--dry=1', '--foo', '--artifact=', '--story=', '--prompt-file=', '--epic=']) {
      const r = run('developer', 'x', bad);
      assert.strictEqual(r.status, 1, `${bad}: ${r.stderr}`);
      assert(r.stderr.includes(`Error: Unknown or malformed flag: ${bad}`), `${bad}: ${r.stderr}`);
    }
  });

  await test('CLI dispatch exits non-zero when dispatch fails', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
    try {
      const run = (cmd) => {
        fs.writeFileSync(path.join(tmp, 'squad.config.json'), JSON.stringify({ ...config, roles: { qa_gatekeeper: { engine: 'cli', command: cmd } } }));
        return spawnSync(process.execPath, [cli, 'dispatch', 'qa_gatekeeper', 'x'], { cwd: tmp, encoding: 'utf8', timeout: 30000 });
      };
      const bad = run('node -e "process.exit(3)"');
      assert.strictEqual(bad.status, 3, bad.stderr + bad.stdout);
      const ok = run('node -e "process.exit(0)"');
      assert.strictEqual(ok.status, 0, ok.stderr + ok.stdout);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await test('isCraftSquadMcpCommand matches only CraftSquad MCP processes; killRunningMcpServer never targets others', () => {
    const cli = require('../bin/cli.js');
    assert.strictEqual(cli.isCraftSquadMcpCommand('node mcp-server/index.js --craft-squad-mcp'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node C:/x/craft-squad/mcp-server/index.js'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node C:\\x\\craft-squad\\mcp-server\\index.js'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node /x/other-plugin/mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand(''), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('editor.exe --search=--craft-squad-mcp'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node C:/craft-squad-tools/other/mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node C:/a/craft-squad/mcp-server/index.js'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('"C:\\Program Files\\nodejs\\node.exe" mcp-server/index.js --craft-squad-mcp'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node -e "setInterval(()=>{},1000)" C:/x/craft-squad/mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node other.js C:/x/craft-squad/mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node --eval=1 C:/x/craft-squad/mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node -r ./pre.js C:/x/craft-squad/mcp-server/index.js'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node --max-old-space-size 512 -- C:/x/craft-squad/mcp-server/index.js'), true);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node --diagnostic-dir C:/x/craft-squad/mcp-server/index.js --eval "console.log(123)"'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node --unknown-flag C:/x/craft-squad/mcp-server/index.js'), false);
    assert.strictEqual(cli.isCraftSquadMcpCommand('node --no-warnings mcp-server/index.js --craft-squad-mcp'), true);

    const procs = [
      { pid: 111, cmd: 'node /home/u/craft-squad/mcp-server/index.js' },
      { pid: 222, cmd: 'node /home/u/other-plugin/mcp-server/index.js' },
      { pid: 333, cmd: 'node mcp-server/index.js --craft-squad-mcp' },
      { pid: 444, cmd: 'node unrelated.js' }
    ];
    const issued = [];
    const fakeExec = (cmd) => {
      if (/Win32_Process|^ps /.test(cmd)) {
        return process.platform === 'win32'
          ? JSON.stringify(procs.map((p) => ({ ProcessId: p.pid, CommandLine: p.cmd })))
          : procs.map((p) => `${p.pid} ${p.cmd}`).join('\n');
      }
      issued.push(cmd);
      return '';
    };
    const prev = process.env.CRAFTSQUAD_SKIP_MCP_KILL;
    delete process.env.CRAFTSQUAD_SKIP_MCP_KILL;
    try {
      cli.killRunningMcpServer(fakeExec);
    } finally {
      if (prev !== undefined) process.env.CRAFTSQUAD_SKIP_MCP_KILL = prev;
    }
    const killed = issued.map((c) => Number(c.match(/\d+/)[0])).sort();
    assert.deepStrictEqual(killed, [111, 333]);
    const skipped = [];
    process.env.CRAFTSQUAD_SKIP_MCP_KILL = '1';
    try { cli.killRunningMcpServer((c) => { skipped.push(c); return ''; }); } finally { delete process.env.CRAFTSQUAD_SKIP_MCP_KILL; }
    assert.strictEqual(skipped.length, 0, 'skip env must short-circuit');
  });

  await test('install refuses overlapping source/target and corrupt config.json fails without being clobbered', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-home-'));
    const cfgDir = path.join(home, '.gemini', 'config');
    const cfgPath = path.join(cfgDir, 'config.json');
    const target = path.join(cfgDir, 'plugins', 'craft-squad');
    const env = { ...process.env, HOME: home, USERPROFILE: home, CRAFTSQUAD_SKIP_MCP_KILL: '1' };
    const run = (script, ...a) => spawnSync(process.execPath, [script, ...a], { cwd: root, encoding: 'utf8', timeout: 60000, env });
    try {
      fs.mkdirSync(cfgDir, { recursive: true });
      const corrupt = '{ not valid json';
      fs.writeFileSync(cfgPath, corrupt);
      const bad = run(cli, 'install');
      assert.notStrictEqual(bad.status, 0, 'corrupt config must fail the install');
      assert.strictEqual(fs.readFileSync(cfgPath, 'utf8'), corrupt, 'corrupt config must not be clobbered');
      const badUninstall = run(cli, 'uninstall');
      assert.notStrictEqual(badUninstall.status, 0);
      assert.strictEqual(fs.readFileSync(cfgPath, 'utf8'), corrupt);

      fs.rmSync(cfgPath);
      assert.strictEqual(run(cli, 'install').status, 0);
      const sentinel = path.join(target, 'sentinel.txt');
      fs.writeFileSync(sentinel, 'keep');
      const self = run(path.join(target, 'bin', 'cli.js'), 'install');
      assert.strictEqual(self.status, 1, self.stdout + self.stderr);
      assert(/same or overlap/.test(self.stderr), self.stderr);
      assert(fs.existsSync(sentinel), 'installed directory must survive a refused self-install');

      fs.rmSync(target, { recursive: true, force: true });
      fs.symlinkSync(root, target, 'junction');
      const linked = run(cli, 'install');
      assert.strictEqual(linked.status, 1, linked.stdout + linked.stderr);
      assert(fs.existsSync(path.join(root, 'plugin.json')), 'source repo must be intact');
    } finally {
      try { if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target); } catch (_) { /* absent */ }
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  await test('CLI install, upgrade --no-pull and uninstall manage plugin dir and config.json in an isolated home', () => {
    const crypto = require('crypto');
    const cli = path.join(root, 'bin', 'cli.js');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-home-'));
    const cfgDir = path.join(home, '.gemini', 'config');
    const cfgPath = path.join(cfgDir, 'config.json');
    const target = path.join(cfgDir, 'plugins', 'craft-squad');
    const tracked = ['templates'].map((p) => path.join(root, p));
    const hashTree = (p, h) => {
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        for (const f of fs.readdirSync(p).sort()) hashTree(path.join(p, f), h);
      } else {
        h.update(path.relative(root, p)).update(fs.readFileSync(p));
      }
      return h;
    };
    const snapshot = () => {
      const git = spawnSync('git', ['status', '--porcelain', '--', ...tracked], { cwd: root, encoding: 'utf8' });
      assert.strictEqual(git.status, 0, `git status failed: ${git.stderr}`);
      const h = crypto.createHash('sha256');
      tracked.forEach((p) => hashTree(p, h));
      return `${git.stdout}\n${h.digest('hex')}`;
    };
    try {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, 'stale.txt'), 'old');
      fs.writeFileSync(cfgPath, JSON.stringify({ keep: 1, plugins: { other: { enabled: true }, 'craft-squad': { custom: 'x', enabled: false } } }));
      const run = (...a) => {
        const r = spawnSync(process.execPath, [cli, ...a], { cwd: root, encoding: 'utf8', timeout: 60000, env: { ...process.env, HOME: home, USERPROFILE: home, CRAFTSQUAD_SKIP_MCP_KILL: '1' } });
        assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      };
      const readCfg = () => JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      const before = snapshot();

      run('install');
      assert(!fs.existsSync(path.join(target, 'stale.txt')), 'stale file should be removed');
      assert(fs.existsSync(path.join(target, 'plugin.json')));
      assert(!fs.existsSync(path.join(target, 'README.md')), 'plugin README.md should not exist or be deployed');
      assert(!fs.existsSync(path.join(target, 'AGENTS.md')), 'repo dev AGENTS.md must not be deployed into plugin root');
      assert(fs.existsSync(path.join(target, 'assets', 'logo.svg')));
      assert(fs.existsSync(path.join(target, 'rules', 'AGENTS.md')));
      assert.strictEqual(readCfg().plugins['craft-squad'].enabled, true);
      assert.strictEqual(readCfg().plugins['craft-squad'].custom, 'x');
      assert.strictEqual(readCfg().keep, 1);
      assert(!fs.readdirSync(path.dirname(target)).some((f) => /\.(staging|bak)-/.test(f)), 'no staging/backup dirs left behind');

      fs.writeFileSync(path.join(target, 'stale.txt'), 'old');
      run('upgrade', '--no-pull');
      assert(!fs.existsSync(path.join(target, 'stale.txt')));
      assert(fs.existsSync(path.join(target, 'plugin.json')));
      assert.strictEqual(snapshot(), before, 'upgrade must not modify templates');

      run('uninstall');
      assert(!fs.existsSync(target), 'plugin dir should be removed');
      assert(!('craft-squad' in readCfg().plugins));
      assert(readCfg().plugins.other.enabled, 'other plugins must be preserved');
      assert(!fs.readdirSync(cfgDir).some((f) => f.endsWith('.tmp')), 'no temp files left behind');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  await test('uninstall removes a junctioned plugin dir without touching its source', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-home-'));
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-src-'));
    const target = path.join(home, '.gemini', 'config', 'plugins', 'craft-squad');
    try {
      fs.writeFileSync(path.join(src, 'keep.txt'), 'keep');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.symlinkSync(src, target, 'junction');
      const r = spawnSync(process.execPath, [cli, 'uninstall'], { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home, CRAFTSQUAD_SKIP_MCP_KILL: '1' } });
      assert.strictEqual(r.status, 0, r.stderr + r.stdout);
      assert.throws(() => fs.lstatSync(target), { code: 'ENOENT' });
      assert(fs.existsSync(path.join(src, 'keep.txt')), 'junction source must survive uninstall');
    } finally {
      try { if (fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target); } catch (_) { /* absent */ }
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  await test('installGlobalPlugin rolls back junction and directory targets when config handling fails', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-home-'));
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-src-'));
    const cfgDir = path.join(home, '.gemini', 'config');
    const cfgPath = path.join(cfgDir, 'config.json');
    const target = path.join(cfgDir, 'plugins', 'craft-squad');
    const env = { ...process.env, HOME: home, USERPROFILE: home, CRAFTSQUAD_SKIP_MCP_KILL: '1' };
    const script = `require(${JSON.stringify(cli)}).installGlobalPlugin({ enableConfig: () => { throw new Error('config write failed'); } });`;
    const install = () => spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', env });
    const noLeftovers = () => assert(!fs.readdirSync(path.dirname(target)).some((f) => /\.(staging|bak)-/.test(f)), 'no staging/backup dirs left behind');
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(path.join(src, 'keep.txt'), 'keep');
      fs.symlinkSync(src, target, 'junction');
      let r = install();
      assert.notStrictEqual(r.status, 0);
      assert(/config write failed/.test(r.stderr), r.stderr);
      assert(fs.lstatSync(target).isSymbolicLink(), 'junction must be restored');
      assert.strictEqual(fs.realpathSync(target), fs.realpathSync(src));
      assert(fs.existsSync(path.join(src, 'keep.txt')));
      noLeftovers();

      fs.unlinkSync(target);
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'orig.txt'), 'orig');
      r = install();
      assert.notStrictEqual(r.status, 0);
      assert.strictEqual(fs.readFileSync(path.join(target, 'orig.txt'), 'utf8'), 'orig', 'original directory must be restored');
      assert(!fs.existsSync(path.join(target, 'plugin.json')), 'new deployment must be rolled back');
      noLeftovers();

      fs.writeFileSync(cfgPath, '{ not valid json');
      r = install();
      assert.notStrictEqual(r.status, 0);
      assert(/Could not read Antigravity configuration/.test(r.stderr), r.stderr);
      assert(fs.existsSync(path.join(target, 'orig.txt')), 'malformed config must fail before any swap');
      noLeftovers();
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  await test('writeJsonAtomic preserves the existing file mode and leaves no temp file', () => {
    const cli = require('../bin/cli.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-json-'));
    const file = path.join(dir, 'config.json');
    try {
      fs.writeFileSync(file, '{}', { mode: 0o600 });
      fs.chmodSync(file, 0o600);
      cli.writeJsonAtomic(file, { a: 1 });
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: 1 });
      if (process.platform !== 'win32') assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
      assert(!fs.readdirSync(dir).some((f) => f.endsWith('.tmp')), 'no temp file left behind');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('writeJsonAtomic removes its temp file and keeps original bytes when rename fails', () => {
    const cli = require('../bin/cli.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-json-fail-'));
    const file = path.join(dir, 'config.json');
    const realRename = fs.renameSync;
    try {
      fs.writeFileSync(file, '{"orig":true}');
      const before = fs.readFileSync(file);
      fs.renameSync = () => { throw new Error('rename boom'); };
      assert.throws(() => cli.writeJsonAtomic(file, { a: 1 }), /rename boom/);
      fs.renameSync = realRename;
      assert(fs.readFileSync(file).equals(before), 'original bytes untouched');
      assert(!fs.readdirSync(dir).some((f) => f.endsWith('.tmp')), 'temp file removed');
    } finally {
      fs.renameSync = realRename;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  await test('installGlobalPlugin rolls back when the real config writeJsonAtomic rename fails', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-home-'));
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-src-'));
    const cfgDir = path.join(home, '.gemini', 'config');
    const cfgPath = path.join(cfgDir, 'config.json');
    const target = path.join(cfgDir, 'plugins', 'craft-squad');
    const env = { ...process.env, HOME: home, USERPROFILE: home, CRAFTSQUAD_SKIP_MCP_KILL: '1' };
    const script = `const fs=require('fs');const r=fs.renameSync;`
      + `fs.renameSync=(a,b)=>{if(String(b).endsWith('config.json'))throw new Error('rename boom');return r(a,b);};`
      + `require(${JSON.stringify(cli)}).installGlobalPlugin();`;
    const install = () => spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', env });
    const artifacts = (d) => fs.readdirSync(d).filter((f) => /\.tmp$|\.staging-|\.bak-/.test(f));
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(cfgPath, '{"plugins":{}}');
      const before = fs.readFileSync(cfgPath);
      fs.writeFileSync(path.join(src, 'keep.txt'), 'keep');
      fs.symlinkSync(src, target, 'junction');
      let r = install();
      assert.notStrictEqual(r.status, 0);
      assert(/rename boom/.test(r.stderr), r.stderr);
      assert(fs.lstatSync(target).isSymbolicLink(), 'junction must be restored');
      assert.strictEqual(fs.realpathSync(target), fs.realpathSync(src));
      assert(fs.readFileSync(cfgPath).equals(before), 'config untouched');
      assert.deepStrictEqual(artifacts(cfgDir).concat(artifacts(path.dirname(target))), []);

      fs.unlinkSync(target);
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, 'orig.txt'), 'orig');
      r = install();
      assert.notStrictEqual(r.status, 0);
      assert.strictEqual(fs.readFileSync(path.join(target, 'orig.txt'), 'utf8'), 'orig');
      assert(!fs.existsSync(path.join(target, 'plugin.json')), 'new deployment rolled back');
      assert(fs.readFileSync(cfgPath).equals(before), 'config untouched');
      assert.deepStrictEqual(artifacts(cfgDir).concat(artifacts(path.dirname(target))), []);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  await test('upgrade pulls a new commit and re-executes the pulled CLI; failures exit non-zero', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-upg-'));
    const remote = path.join(tmp, 'remote.git');
    const seed = path.join(tmp, 'seed');
    const clone = path.join(tmp, 'clone');
    const marker = path.join(tmp, 'marker.json');
    const env = { ...process.env, HOME: tmp, USERPROFILE: tmp, CRAFTSQUAD_SKIP_MCP_KILL: '1', GIT_TERMINAL_PROMPT: '0' };
    const git = (cwd, ...a) => {
      const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', env });
      assert.strictEqual(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
      return r;
    };
    const stub = (exitCode) => `require('fs').writeFileSync(${JSON.stringify(marker)}, JSON.stringify(process.argv.slice(2)));\nprocess.exit(${exitCode});\n`;
    const upgrade = () => spawnSync(process.execPath, [path.join(clone, 'plugin', 'bin', 'cli.js'), 'upgrade'], { cwd: clone, encoding: 'utf8', timeout: 60000, env });
    try {
      fs.mkdirSync(path.join(seed, 'plugin', 'bin'), { recursive: true });
      fs.copyFileSync(path.join(root, 'bin', 'cli.js'), path.join(seed, 'plugin', 'bin', 'cli.js'));
      fs.cpSync(path.join(root, 'mcp-server'), path.join(seed, 'plugin', 'mcp-server'), { recursive: true, filter: (s) => !s.includes('node_modules') });
      git(tmp, 'init', '--bare', remote);
      git(seed, 'init');
      git(seed, 'add', '-A');
      git(seed, 'commit', '-m', 'init');
      git(seed, 'branch', '-M', 'main');
      git(seed, 'remote', 'add', 'origin', remote);
      git(seed, 'push', '-u', 'origin', 'main');
      git(tmp, 'clone', '--branch', 'main', remote, clone);

      // New remote commit replaces the CLI with a stub that records its arguments.
      fs.writeFileSync(path.join(seed, 'plugin', 'bin', 'cli.js'), stub(0));
      git(seed, 'commit', '-am', 'stub cli');
      git(seed, 'push');
      let r = upgrade();
      assert.strictEqual(r.status, 0, r.stdout + r.stderr);
      assert.deepStrictEqual(JSON.parse(fs.readFileSync(marker, 'utf8')), ['upgrade', '--no-pull']);

      // A failing pulled CLI propagates its exit code.
      fs.rmSync(marker);
      git(clone, 'reset', '--hard', 'HEAD~1');
      fs.writeFileSync(path.join(seed, 'plugin', 'bin', 'cli.js'), stub(3));
      git(seed, 'commit', '-am', 'failing stub');
      git(seed, 'push');
      r = upgrade();
      assert.strictEqual(r.status, 3, r.stdout + r.stderr);

      // A diverged remote cannot fast-forward.
      git(clone, 'reset', '--hard', 'HEAD~2');
      fs.writeFileSync(path.join(clone, 'local.txt'), 'x');
      git(clone, 'add', '-A');
      git(clone, 'commit', '-m', 'local divergence');
      r = upgrade();
      assert.strictEqual(r.status, 1, r.stdout + r.stderr);
      assert(/git pull failed/.test(r.stderr), r.stderr);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  await test('CLI help and sibling tool cx forwarding work', () => {
    const cli = path.join(root, 'bin', 'cli.js');
    const help = spawnSync(process.execPath, [cli, '--help'], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(help.status, 0, help.stderr);
    assert(help.stdout.includes('CraftSquad CLI') && help.stdout.includes('studio'));
    const cxHelp = spawnSync(process.execPath, [cli, 'cx', '--help'], { cwd: root, encoding: 'utf8' });
    assert.strictEqual(cxHelp.status, 0, cxHelp.stderr);
    assert(cxHelp.stdout.includes('CraftSquad Account Switcher') && cxHelp.stdout.includes('cx claude'));
  });

  fs.rmSync(cxSandbox, { recursive: true, force: true });
  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
})();
