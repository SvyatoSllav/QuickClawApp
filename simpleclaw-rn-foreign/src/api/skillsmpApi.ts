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
  subcategories?: { label: string; count: number }[];
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  { key: 'tools', label: 'Tools', count: 71840 },
  { key: 'development', label: 'Development', count: 56892 },
  { key: 'business', label: 'Business', count: 44784 },
  { key: 'data-ai', label: 'Data & AI', count: 37420 },
  { key: 'devops', label: 'DevOps', count: 30103 },
  { key: 'testing-security', label: 'Testing & Security', count: 28556 },
  { key: 'documentation', label: 'Documentation', count: 20194 },
  { key: 'content-media', label: 'Content & Media', count: 19703 },
  { key: 'research', label: 'Research', count: 10209 },
  { key: 'databases', label: 'Databases', count: 4511 },
  { key: 'lifestyle', label: 'Lifestyle', count: 3939 },
  { key: 'blockchain', label: 'Blockchain', count: 3648 },
];
