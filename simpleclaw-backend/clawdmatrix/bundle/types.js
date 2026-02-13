// ClawdMatrix Prompt Engine — Type definitions (JS runtime, no types needed)
// Interfaces are documented here as JSDoc for reference only.

/**
 * @typedef {Object} IntentContext
 * @property {string} domain
 * @property {string|null} userLevel
 * @property {string|null} tone
 * @property {'COMPLETE'|'MISSING'} status
 * @property {string[]} [missingFields]
 * @property {'RULE_BASED'|'LLM_INFERENCE'|'FALLBACK'} [source]
 */

/**
 * @typedef {Object} SkillDefinition
 * @property {string} skill_name
 * @property {string} description
 * @property {string[]} [associated_domains]
 * @property {SkillVariant[]} [variants]
 * @property {string} [generalized_instruction_template]
 */

/**
 * @typedef {Object} SkillVariant
 * @property {string} variant_name
 * @property {string} generalized_instruction_template
 */

export {};
