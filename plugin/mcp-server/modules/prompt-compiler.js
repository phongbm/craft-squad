/**
 * CraftSquad - Prompt Compiler
 *
 * Builds the system prompt for a squad role at RUNTIME by reading, from disk:
 *   1. charters/<role>.md                    (role charter: mission, duties, boundaries, persona)
 *   2. templates/craftsquad/review/*.md      (review lenses always injected for the role)
 *   3. templates/craftsquad/*-template.md    (output template for the requested artifactType)
 *
 * Nothing is copied into code, so editing a charter or template changes behaviour immediately.
 * No model, engine or effort information lives here; that is squad.config.json's job.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const chartersDir = path.join(rootDir, 'charters');
const templatesDir = path.join(rootDir, 'templates', 'craftsquad');

const tpl = (name) => path.join(templatesDir, `${name}-template.md`);
const lens = (name) => path.join(templatesDir, 'review', `${name}.md`);

/**
 * Role -> sources.
 *  always:    files always injected
 *  artifacts: artifactType -> files injected (first key is the default)
 */
const ROLE_SOURCES = {
  spec_owner: {
    always: [],
    artifacts: {
      spec: [tpl('spec')],
      epic: [tpl('epic')],
      story: [tpl('story')],
      checklist: [tpl('checklist')]
    }
  },
  scrum_master: {
    always: [],
    artifacts: {
      story: [tpl('story')],
      epic: [tpl('epic')],
      tasks: [tpl('tasks')],
      bug: [tpl('bug')]
    }
  },
  architect: {
    always: [],
    artifacts: {
      plan: [tpl('plan')]
    }
  },
  ui_designer: { always: [], artifacts: {} },
  developer: { always: [], artifacts: {} },
  code_reviewer: {
    always: [lens('adversarial'), lens('edge-case-hunter'), lens('verification-gap')],
    artifacts: {}
  },
  tester: {
    always: [lens('verification-gap')],
    artifacts: {
      checklist: [tpl('checklist')]
    }
  },
  rescue: { always: [], artifacts: {} },
  qa_gatekeeper: { always: [], artifacts: {} }
};

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
    const refParts = def.always.map((f) => fileBlock(f, 'Review lens', sources, missing)).filter(Boolean);
    if (refParts.length) parts.push(`## Review lenses\n\n${refParts.join('\n\n')}`);

    const types = Object.keys(def.artifacts);
    if (types.length) {
      artifactType = options.artifactType || types[0];
      const files = def.artifacts[artifactType];
      if (!files) {
        throw new Error(`Unknown artifactType "${artifactType}" for role "${roleKey}". Valid: [${types.join(', ')}]`);
      }
      const tplParts = files.map((f) => fileBlock(f, `Required artifact template: ${artifactType}`, sources, missing)).filter(Boolean);
      if (tplParts.length) {
        parts.push(`## Output template\n\nFollow this template's structure exactly.\n\n${tplParts.join('\n\n')}`);
      }
    }
  }

  parts.push(`## Task\n\n${taskPrompt}`);
  return { prompt: parts.join('\n\n---\n\n'), sources, missing, artifactType };
}

module.exports = {
  ROLE_SOURCES,
  compileRolePrompt,
  listArtifactTypes
};
