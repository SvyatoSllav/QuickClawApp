import { SkillInjector } from './injector.js';
import { SkillsLoader } from './skills-loader.js';
import { Triangulator } from './triangulator.js';

export class ClawdMatrix {
  static instance = null;

  static getInstance() {
    if (!ClawdMatrix.instance) {
      ClawdMatrix.instance = new ClawdMatrix();
    }
    return ClawdMatrix.instance;
  }

  static async build(query, context) {
    return this.getInstance().process(query, context);
  }

  async process(query, context) {
    const routingResult = await Triangulator.analyze(query);

    const skills = await SkillsLoader.getSkillsForDomain(routingResult.domain);

    const activeSkills = skills.map(skill =>
      SkillInjector.instantiate(skill, context || routingResult)
    ).join('\n\n');

    return this.assemblePrompt(routingResult.domain, activeSkills, context || routingResult);
  }

  assemblePrompt(domain, skillInstructions, _context) {
    return `
# Role
You are an AI assistant specialized in ${domain}.

# Active Context
Current Domain: ${domain}

# Enabled Skills
${skillInstructions}
`.trim();
  }
}
