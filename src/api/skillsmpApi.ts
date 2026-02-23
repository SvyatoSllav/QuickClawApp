import apiClient from './client';

export interface SkillsmpSkill {
  id: string;
  name: string;
  description: string;
  author?: string;
  stars?: number;
  installs?: number;
  tags?: string[];
  icon?: string;
  slug?: string;
  githubUrl?: string;
  skillUrl?: string;
  updatedAt?: number;
}

export interface SkillsSearchResult {
  skills: SkillsmpSkill[];
  total: number;
  page: number;
  limit: number;
}

// In-memory cache: key → { data, expiry }
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const memCache = new Map<string, { data: SkillsSearchResult; expiry: number }>();

export async function searchSkills(
  query: string = '',
  page: number = 1,
  limit: number = 20,
  sortBy: 'stars' | 'recent' = 'stars',
): Promise<SkillsSearchResult> {
  const cacheKey = `${query}:${page}:${limit}:${sortBy}`;
  const cached = memCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const response = await apiClient.get('/skills/search/', {
    params: { q: query, page, limit, sortBy },
  });
  const data: SkillsSearchResult = response.data;

  memCache.set(cacheKey, { data, expiry: Date.now() + CACHE_TTL });
  return data;
}

export interface SkillCategory {
  key: string;
  label: string;
  count: number;
  icon: string;
  subcategories?: { label: string; count: number }[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  { key: 'tools', label: 'Tools', count: 71840, icon: 'Wrench' },
  { key: 'development', label: 'Development', count: 56892, icon: 'Code' },
  { key: 'business', label: 'Business', count: 44784, icon: 'Briefcase' },
  { key: 'data-ai', label: 'Data & AI', count: 37420, icon: 'BrainCircuit' },
  { key: 'devops', label: 'DevOps', count: 30103, icon: 'Container' },
  { key: 'testing-security', label: 'Testing & Security', count: 28556, icon: 'ShieldCheck' },
  { key: 'documentation', label: 'Documentation', count: 20194, icon: 'FileText' },
  { key: 'content-media', label: 'Content & Media', count: 19703, icon: 'Image' },
  { key: 'research', label: 'Research', count: 10209, icon: 'FlaskConical' },
  { key: 'databases', label: 'Databases', count: 4511, icon: 'Database' },
  { key: 'lifestyle', label: 'Lifestyle', count: 3939, icon: 'Heart' },
  { key: 'blockchain', label: 'Blockchain', count: 3648, icon: 'Link' },
];
