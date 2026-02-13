import { SkillsLoader } from './skills-loader.js';

export class Triangulator {
  static cachedRules = null;

  static async getRules() {
    if (this.cachedRules) return this.cachedRules;

    const domainTriggers = await SkillsLoader.getDomainTriggers();

    this.cachedRules = domainTriggers.map(dt => {
      const patternString = dt.patterns
        .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');

      return {
        domain: dt.domain,
        regex: new RegExp(`(?:^|\\s|\\b)(${patternString})(?:\\s|$|\\b)`, 'iu')
      };
    });

    this.cachedRules.push({
      domain: 'General',
      regex: /^(hi|hello|hey|hola|greetings|help|start|привет|здравствуйте|помоги|начать)$/iu
    });

    return this.cachedRules;
  }

  static async analyze(input, classifier) {
    const rules = await this.getRules();

    for (const rule of rules) {
      if (rule.regex.test(input)) {
        return this.createContext(rule.domain, 'COMPLETE', 'RULE_BASED');
      }
    }

    if (classifier) {
      try {
        const llmResult = await classifier.classify(input);
        const domain = llmResult.domain || 'General';
        const status = this.evaluateCompleteness(llmResult) ? 'COMPLETE' : 'MISSING';

        return {
          domain,
          userLevel: llmResult.userLevel || null,
          tone: llmResult.tone || null,
          status,
          missingFields: status === 'MISSING' ? this.findMissingFields(llmResult) : [],
          source: 'LLM_INFERENCE'
        };
      } catch (error) {
        console.warn('[ClawdMatrix] LLM classification failed, falling back.', error);
      }
    }

    return this.createContext('General', 'COMPLETE', 'FALLBACK');
  }

  static createContext(domain, status, source) {
    return {
      domain,
      status,
      source,
      userLevel: null,
      tone: null,
      missingFields: []
    };
  }

  static evaluateCompleteness(result) {
    return !!result.domain;
  }

  static findMissingFields(result) {
    const missing = [];
    if (!result.domain) missing.push('domain');
    return missing;
  }
}
