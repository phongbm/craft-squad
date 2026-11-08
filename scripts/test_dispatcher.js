/**
 * Test script for Engine Dispatcher v2.2
 * Verifies role resolution, engine routing, and reasoning effort rules:
 * - Gemini 3.8 Flash roles default to "high"
 * - Other roles default to "medium"
 * - Prompt overrides [effort: ...] always take precedence
 */
const { resolveConfig, detectReasoningEffort, dispatchRole } = require('../mcp-server/modules/dispatcher');

console.log('=== TEST 1: Config Resolution ===');
const { config, filePath } = resolveConfig();
console.log('Config loaded from:', filePath);
console.log('Configured roles:', Object.keys(config.roles));
console.assert(config.roles.developer.engine === 'claude', 'Developer should be claude');
console.assert(config.roles.code_reviewer.engine === 'codex', 'Reviewer should be codex');
console.assert(config.roles.tester.engine === 'gemini', 'Tester should be gemini');
console.assert(config.roles.scrum_master.engine === 'gemini', 'Scrum master should be gemini');
console.log('✅ Config resolution PASSED');

console.log('\n=== TEST 2: Reasoning Effort Rules ===');

// Case A: Gemini role without prompt tag -> should be "high"
const geminiRole = config.roles.tester;
const geminiEffort = detectReasoningEffort('Run tests', null, geminiRole);
console.log('Gemini 3.8 Flash default effort:', geminiEffort);
console.assert(geminiEffort === 'high', 'Gemini role must default to high');

// Case B: Non-Gemini role without prompt tag -> should be "medium"
const codexRole = config.roles.code_reviewer;
const codexEffort = detectReasoningEffort('Review code', null, codexRole);
console.log('Codex default effort:', codexEffort);
console.assert(codexEffort === 'medium', 'Non-gemini role must default to medium');

const claudeRole = config.roles.developer;
const claudeEffort = detectReasoningEffort('Write code', null, claudeRole);
console.log('Claude default effort:', claudeEffort);
console.assert(claudeEffort === 'medium', 'Claude role must default to medium');

// Case C: Prompt override on Gemini role -> prompt wins
const geminiOverride = detectReasoningEffort('Quick test run [effort: low]', null, geminiRole);
console.log('Gemini with [effort: low]:', geminiOverride);
console.assert(geminiOverride === 'low', 'Prompt override must take precedence on Gemini');

// Case D: Prompt override on Non-Gemini role -> prompt wins
const claudeOverride = detectReasoningEffort('Complex algorithm [effort: high]', null, claudeRole);
console.log('Claude with [effort: high]:', claudeOverride);
console.assert(claudeOverride === 'high', 'Prompt override must take precedence on Claude');

console.log('✅ All Reasoning effort rules PASSED');

console.log('\n=== TEST 3: Dispatch Routing & Parameter Verification ===');
async function runDispatchTests() {
  // Test Tester (Gemini) -> Effort should be high
  const testerRes = await dispatchRole('tester', 'Verify unit tests');
  console.log('Tester dispatch:', {
    role: testerRes.role,
    engine: testerRes.engine,
    effort: testerRes.reasoningEffort
  });
  console.assert(testerRes.engine === 'gemini', 'Tester engine should be gemini');
  console.assert(testerRes.reasoningEffort === 'high', 'Tester default effort must be high');
  console.log('✅ Tester default effort (high) verified');

  // Test Scrum Master with prompt override -> Effort should be low
  const smRes = await dispatchRole('scrum_master', 'Brief sprint summary [effort: low]');
  console.log('Scrum Master with override:', {
    role: smRes.role,
    effort: smRes.reasoningEffort
  });
  console.assert(smRes.reasoningEffort === 'low', 'Scrum Master effort must be overridden to low');
  console.log('✅ Scrum Master prompt override (low) verified');

  // Test Developer (Claude) -> Default should be medium
  const devRes = await dispatchRole('developer', 'Build customer service route');
  console.log('Developer dispatch:', {
    role: devRes.role,
    engine: devRes.engine,
    effort: devRes.reasoningEffort
  });
  console.assert(devRes.engine === 'claude', 'Developer engine should be claude');
  console.assert(devRes.reasoningEffort === 'medium', 'Developer default effort must be medium');
  console.log('✅ Developer default effort (medium) verified');

  console.log('\n🎉 ALL DISPATCHER & EFFORT TESTS PASSED 100%!');
}

runDispatchTests().catch(console.error);
