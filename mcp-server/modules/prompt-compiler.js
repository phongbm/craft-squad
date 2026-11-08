/**
 * CraftSquad - Prompt Compiler
 *
 * Builds the system prompt for a squad role at RUNTIME by reading, from disk:
 *   1. charters/<role>.md                      (CraftSquad role charter: duties, boundaries, handoff)
 *   2. templates/bmad/skills/<skill>/customize.toml  (upstream BMAD persona: role, identity, principles)
 *   3. upstream reference / lens / template files    (BMAD + GitHub Spec-Kit, synced by `npm run sync:upstream`)
 *
 * Nothing upstream is copied into code, so re-syncing upstream changes behaviour immediately.
 * No model, engine or effort information lives here; that is squad.config.json's job.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const bmadSkills = path.join(rootDir, 'templates', 'bmad', 'skills');
const speckitTemplates = path.join(rootDir, 'templates', 'speckit', 'templates');
const chartersDir = path.join(rootDir, 'charters');

const bmad = (...p) => path.join(bmadSkills, ...p);
const speckit = (...p) => path.join(speckitTemplates, ...p);

/**
 * Role -> upstream sources.
 *  personas:  BMAD skill folders whose customize.toml [agent] section is injected
 *  always:    files always injected
 *  artifacts: artifactType -> files injected (first key is the default)
 */
const ROLE_SOURCES = {
  spec_owner: {
    personas: ['bmad-agent-po'],
    always: [bmad('bmad-agent-po', 'references', 'spec.md')],
    artifacts: {
      spec: [speckit('spec-template.md')],
      constitution: [speckit('constitution-template.md')],
      checklist: [speckit('checklist-template.md')]
    }
  },
  scrum_master: {
    personas: ['bmad-agent-po'],
    always: [
      bmad('bmad-agent-po', 'references', 'slice.md'),
      bmad('bmad-agent-po', 'references', 'board.md')
    ],
    artifacts: {
      tasks: [speckit('tasks-template.md')],
      ticket: [bmad('bmad-agent-po', 'assets', 'ticket-template.md')],
      bug: [bmad('bmad-agent-po', 'assets', 'bug-template.md')],
      spike: [bmad('bmad-agent-po', 'assets', 'spike-template.md')]
    }
  },
  architect: {
    personas: ['bmad-agent-architect'],
    always: [],
    artifacts: {
      plan: [speckit('plan-template.md')],
      spine: [bmad('bmad-architecture', 'assets', 'spine-template.md')]
    }
  },
  ui_designer: {
    personas: ['bmad-agent-ux-designer'],
    always: [],
    artifacts: {}
  },
  developer: {
    personas: ['bmad-agent-dev'],
    always: [],
    artifacts: {}
  },
  code_reviewer: {
    personas: [],
    always: [
      bmad('bmad-review', 'references', 'lens-adversarial.md'),
      bmad('bmad-code-review', 'review-prompts', 'edge-case-hunter.md'),
      bmad('bmad-code-review', 'review-prompts', 'verification-gap.md')
    ],
    artifacts: {}
  },
  tester: {
    personas: ['bmad-agent-dev'],
    always: [bmad('bmad-code-review', 'review-prompts', 'verification-gap.md')],
    artifacts: {
      checklist: [speckit('checklist-template.md')]
    }
  },
  rescue: {
    personas: ['bmad-agent-architect', 'bmad-agent-dev'],
    always: [],
    artifacts: {}
  },
  qa_gatekeeper: {
    personas: [],
    always: [],
    artifacts: {}
  }
};

/**
 * Minimal TOML reader for the [agent] table of BMAD customize.toml.
 * Supports: key = "string", key = ["a", "b"] (multi-line), comments. Stops at the first [[...]] or non-agent table.
 */
function parseAgentToml(text) {
  const out = {};
  const lines = text.split(/\r?\n/);
  let inAgent = false;
  let i = 0;

  const unescape = (s) => s.replace(/\\(["\\nt])/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
  const readStrings = (src) => {
    const items = [];
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(src)) !== null) items.push(unescape(m[1]));
    return items;
  };

  while (i < lines.length) {
    const line = lines[i].trim();
    i += 1;
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('[')) {
      if (line === '[agent]') { inAgent = true; continue; }
      if (inAgent) break;
      continue;
    }
    if (!inAgent) continue;

    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (value.startsWith('[')) {
      let buf = value;
      while (!/\]\s*(#.*)?$/.test(buf) && i < lines.length) {
        buf += '\n' + lines[i];
        i += 1;
      }
      out[key] = readStrings(buf);
    } else if (value.startsWith('"')) {
      const strings = readStrings(value);
      out[key] = strings.length ? strings[0] : '';
    }
  }
  return out;
}

function readIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return null;
  }
}

function rel(file) {
  return path.relative(rootDir, file).replace(/\\/g, '/');
}

function personaBlock(skillDir, sources, missing) {
  const file = bmad(skillDir, 'customize.toml');
  const text = readIfExists(file);
  if (text === null) { missing.push(rel(file)); return ''; }
  sources.push(rel(file));
  const a = parseAgentToml(text);
  const lines = [`### Upstream BMAD persona: ${a.name || skillDir}${a.title ? ' - ' + a.title : ''}`];
  if (a.role) lines.push(`Role: ${a.role}`);
  if (a.identity) lines.push(`Identity: ${a.identity}`);
  if (a.communication_style) lines.push(`Communication style: ${a.communication_style}`);
  if (Array.isArray(a.principles) && a.principles.length) {
    lines.push('Principles:');
    a.principles.forEach((p) => lines.push(`- ${p}`));
  }
  return lines.join('\n');
}

function fileBlock(file, title, sources, missing) {
  const text = readIfExists(file);
  if (text === null) { missing.push(rel(file)); return ''; }
  sources.push(rel(file));
  return `### ${title} (${rel(file)})\n\n${text.trim()}`;
}

function listArtifactTypes(roleKey) {
  const def = ROLE_SOURCES[roleKey];
  return def ? Object.keys(def.artifacts) : [];
}

/**
 * Compile the system prompt for a role.
 * @returns {{ prompt: string, sources: string[], missing: string[], artifactType: string|null }}
 */
function compileRolePrompt(roleKey, taskPrompt, options = {}) {
  const def = ROLE_SOURCES[roleKey];
  const sources = [];
  const missing = [];
  const parts = [];

  const charterFile = path.join(chartersDir, `${roleKey}.md`);
  const charter = readIfExists(charterFile);
  if (charter !== null) {
    sources.push(rel(charterFile));
    parts.push(`## CraftSquad role charter\n\n${charter.trim()}`);
  } else if (def) {
    missing.push(rel(charterFile));
  }

  let artifactType = null;
  if (def) {
    const personaParts = def.personas.map((s) => personaBlock(s, sources, missing)).filter(Boolean);
    if (personaParts.length) parts.push(`## Upstream persona and principles\n\n${personaParts.join('\n\n')}`);

    const refParts = def.always.map((f) => fileBlock(f, 'Upstream reference', sources, missing)).filter(Boolean);
    if (refParts.length) parts.push(`## Upstream method references\n\n${refParts.join('\n\n')}`);

    const types = Object.keys(def.artifacts);
    if (types.length) {
      artifactType = options.artifactType || types[0];
      const files = def.artifacts[artifactType];
      if (!files) {
        throw new Error(`Unknown artifactType "${artifactType}" for role "${roleKey}". Valid: [${types.join(', ')}]`);
      }
      const tplParts = files.map((f) => fileBlock(f, `Required artifact template: ${artifactType}`, sources, missing)).filter(Boolean);
      if (tplParts.length) {
        parts.push(`## Output template\n\nFollow this upstream template's structure exactly.\n\n${tplParts.join('\n\n')}`);
      }
    }
  }

  parts.push(`## Task\n\n${taskPrompt}`);
  return { prompt: parts.join('\n\n---\n\n'), sources, missing, artifactType };
}

module.exports = {
  ROLE_SOURCES,
  parseAgentToml,
  compileRolePrompt,
  listArtifactTypes
};
