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
const { compileRolePrompt, parseAgentToml, ROLE_SOURCES } = require('../mcp-server/modules/prompt-compiler');

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

  await test('TOML parser reads upstream BMAD persona (name, role, principles)', () => {
    const t = fs.readFileSync(path.join(root, 'templates/bmad/skills/bmad-agent-dev/customize.toml'), 'utf8');
    const a = parseAgentToml(t);
    assert.strictEqual(a.name, 'Amelia');
    assert(a.role && a.identity);
    assert(Array.isArray(a.principles) && a.principles.length >= 3);
    assert(a.principles.some((p) => /passing tests/.test(p)));
  });

  await test('compiler reads every declared upstream source from disk (none missing)', () => {
    for (const role of Object.keys(ROLE_SOURCES)) {
      const types = Object.keys(ROLE_SOURCES[role].artifacts);
      for (const t of types.length ? types : [undefined]) {
        const r = compileRolePrompt(role, 'TASK', { artifactType: t });
        assert.deepStrictEqual(r.missing, [], `${role}/${t} missing: ${r.missing.join(', ')}`);
        assert(r.prompt.includes('TASK'));
      }
    }
  });

  await test('compiled prompts embed real upstream content', () => {
    const arch = compileRolePrompt('architect', 'T', { artifactType: 'spine' });
    assert(/Architecture Spine/.test(arch.prompt) && /Winston/.test(arch.prompt));
    const spec = compileRolePrompt('spec_owner', 'T', { artifactType: 'spec' });
    assert(/Feature Specification/.test(spec.prompt) && /Sofia/.test(spec.prompt));
    const rev = compileRolePrompt('code_reviewer', 'T');
    assert(/Edge Case Hunter/.test(rev.prompt) && /Verification Gap/.test(rev.prompt));
    const tasks = compileRolePrompt('scrum_master', 'T');
    assert(/Tasks:/.test(tasks.prompt));
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

  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
})();
