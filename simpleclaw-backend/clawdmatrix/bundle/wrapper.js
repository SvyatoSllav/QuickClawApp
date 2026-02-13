/**
 * ClawdMatrix Wrapper for OpenClaw
 *
 * This wrapper hooks the ClawdMatrix engine into OpenClaw's system prompt pipeline.
 * It works by intercepting the system prompt construction and injecting domain-aware
 * skill instructions based on user message analysis.
 *
 * Integration method: Called via a cron-like mechanism or injected into OpenClaw's
 * CLAUDE.md / system prompt configuration. The simplest and most robust approach is
 * to inject ClawdMatrix output as a prefix to OpenClaw's system prompt via the
 * `agents.defaults.systemPromptPrefix` config, or as an appended CLAUDE.md section.
 *
 * Usage:
 *   node /app/clawdmatrix/wrapper.js "user message text"
 *   → Outputs the ClawdMatrix prompt block to stdout for piping/injection
 */

import { ClawdMatrix } from './clawd-matrix.js';
import { Triangulator } from './triangulator.js';
import { SkillsLoader } from './skills-loader.js';
import { SkillInjector } from './injector.js';
import { SYSTEM_DIRECTIVES } from './system-directives.js';

/**
 * Build the full ClawdMatrix prompt section for a given user message.
 * Returns a formatted string ready to be injected into the system prompt.
 */
export async function buildClawdMatrixSection(userMessage) {
  if (!userMessage || !userMessage.trim()) {
    return '';
  }

  try {
    const context = await Triangulator.analyze(userMessage);
    const skills = await SkillsLoader.getSkillsForDomain(context.domain);

    const instantiatedSkills = skills
      .map(skill => SkillInjector.instantiate(skill, context))
      .join('\n\n');

    const lines = [
      `# System Prompt: ${SYSTEM_DIRECTIVES.PERSONA.ROLE}`,
      '',
      '## 1. Role & Identity',
      `* **Role**: Acting as a specialist in ${context.domain}.`,
      `* **Tone**: ${context.tone || 'Professional and Adaptive'}.`,
      `* **Core Philosophy**: ${SYSTEM_DIRECTIVES.PERSONA.CORE_PHILOSOPHY}`,
      '',
      '## 2. Constraints & Quality Gates',
      ...SYSTEM_DIRECTIVES.QUALITY_GATES.NEGATIVE_CONSTRAINTS.map(c => `- ${c}`),
      '',
      '## 3. Active Skills Library',
      instantiatedSkills,
      '',
      '## 4. Execution Workflow',
      '1. Analyze the user\'s request using [Skill: Requirement_Triangulation].',
      '2. Execute domain-specific logic from Active Skills Library.',
      '3. Verify output against Constraints before responding.',
    ];

    return lines.join('\n');
  } catch (error) {
    console.error('[ClawdMatrix] Error building prompt section:', error);
    return '';
  }
}

/**
 * Generate a static CLAUDE.md content block with ClawdMatrix instructions.
 * This approach doesn't require runtime interception — it writes a comprehensive
 * set of instructions that the AI agent will follow.
 */
export async function generateClaudeMdBlock() {
  const library = await SkillsLoader.loadLibrary();
  const domainMap = await SkillsLoader.loadDomainMap();

  const domainDescriptions = Object.entries(domainMap.domains)
    .map(([domain, config]) => {
      const triggers = config.triggers.slice(0, 10).join(', ');
      const skills = config.skills.join(', ');
      return `- **${domain}**: triggers=[${triggers}...], skills=[${skills}]`;
    })
    .join('\n');

  const globalSkills = (domainMap.global_defaults || []).join(', ');

  return `
# ClawdMatrix Engine — Domain-Aware Skill Injection

You have access to the ClawdMatrix prompt engine. When processing user messages,
follow this protocol:

## Intent Detection
Analyze each user message to determine the domain. Use these keyword triggers:

${domainDescriptions}

## Global Skills (always active)
${globalSkills}

## Protocol
1. Detect the domain from the user's message using keyword matching
2. Load ONLY the skills mapped to that domain + global defaults
3. Apply domain-specific variable bindings to skill templates
4. Follow Quality Gates: no ambiguity, no naked numbers, verify before responding
5. If no domain matches, use General domain with fallback reasoning

## Quality Gates
${SYSTEM_DIRECTIVES.QUALITY_GATES.NEGATIVE_CONSTRAINTS.map(c => `- ${c}`).join('\n')}

## Safety
${SYSTEM_DIRECTIVES.QUALITY_GATES.SAFETY.map(s => `- ${s}`).join('\n')}
`.trim();
}

// CLI mode: run with a user message argument
if (process.argv[1] && process.argv[1].includes('wrapper.js')) {
  const mode = process.argv[2];

  if (mode === '--claude-md') {
    generateClaudeMdBlock().then(block => {
      console.log(block);
    }).catch(err => {
      console.error('[ClawdMatrix] Failed to generate CLAUDE.md block:', err);
      process.exit(1);
    });
  } else if (mode && mode !== '--help') {
    const userMessage = process.argv.slice(2).join(' ');
    buildClawdMatrixSection(userMessage).then(section => {
      console.log(section);
    }).catch(err => {
      console.error('[ClawdMatrix] Failed to build section:', err);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  node wrapper.js "user message"     — Build prompt section for a message');
    console.log('  node wrapper.js --claude-md         — Generate CLAUDE.md block');
  }
}
