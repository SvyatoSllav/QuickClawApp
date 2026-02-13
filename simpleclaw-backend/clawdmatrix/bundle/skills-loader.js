import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_PATH = path.join(__dirname, 'data', 'skills.json');
const MAP_PATH = path.join(__dirname, 'data', 'domain-map.json');

export class SkillsLoader {
  static libraryCache = null;
  static mapCache = null;

  static async loadLibrary() {
    if (this.libraryCache) return this.libraryCache;
    try {
      const rawData = await fs.readFile(SKILLS_PATH, 'utf-8');
      this.libraryCache = JSON.parse(rawData);
      return this.libraryCache;
    } catch (error) {
      console.error('[ClawdMatrix] Failed to load skills library:', error);
      return {};
    }
  }

  static async loadDomainMap() {
    if (this.mapCache) return this.mapCache;
    try {
      const rawData = await fs.readFile(MAP_PATH, 'utf-8');
      this.mapCache = JSON.parse(rawData);
      return this.mapCache;
    } catch (error) {
      console.warn('[ClawdMatrix] Domain map not found or invalid.', error);
      return { domains: {} };
    }
  }

  static async getDomainTriggers() {
    const map = await this.loadDomainMap();
    return Object.entries(map.domains).map(([domain, config]) => ({
      domain,
      patterns: config.triggers || []
    }));
  }

  static async getSkillsForDomain(domain) {
    const library = await this.loadLibrary();
    const map = await this.loadDomainMap();
    const loadedSkills = [];

    const targetKey = Object.keys(map.domains).find(
      k => k.toLowerCase() === domain.toLowerCase()
    );

    const skillNames = targetKey ? [...map.domains[targetKey].skills] : [];

    if (map.global_defaults) {
      skillNames.push(...map.global_defaults);
    }

    for (const name of new Set(skillNames)) {
      const skill = this.findSkill(library, name);
      if (skill) {
        loadedSkills.push(skill);
      }
    }

    if (loadedSkills.length === 0) {
      const generalSkill = this.findSkill(library, 'General_Reasoning');
      if (generalSkill) loadedSkills.push(generalSkill);
    }

    return loadedSkills;
  }

  static findSkill(library, skillName) {
    for (const key in library) {
      const section = library[key];
      if (section.skills) {
        const found = section.skills.find(s => s.skill_name === skillName);
        if (found) return found;
      }
      if (section.categories) {
        const foundInNested = this.findInCategories(section.categories, skillName);
        if (foundInNested) return foundInNested;
      }
    }
    return null;
  }

  static findInCategories(categories, skillName) {
    for (const category of categories) {
      const found = category.skills.find(s => s.skill_name === skillName);
      if (found) return found;
    }
    return null;
  }
}
