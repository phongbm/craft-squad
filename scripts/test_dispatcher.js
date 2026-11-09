/**
 * CraftSquad tests. Offline: nothing here launches Codex/Claude (dryRun only).
 * Run: npm run test:dispatcher
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { resolveConfig, detectReasoningEffort, dispatchRole, setRole } = require('../mcp-server/modules/dispatcher');
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

  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
})();
