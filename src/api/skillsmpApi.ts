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

export interface SkillDetail extends SkillsmpSkill {
  readme?: string;
  content?: string;
  metadata?: Record<string, string>;
  homepage?: string;
  version?: string;
  dependencies?: string[];
  category?: string;
}

// Detail cache
const detailCache = new Map<string, { data: SkillDetail; expiry: number }>();

export async function getSkillDetail(slug: string): Promise<SkillDetail> {
  const cached = detailCache.get(slug);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const response = await apiClient.get(`/skills/${slug}/`);
  const data: SkillDetail = response.data;

  detailCache.set(slug, { data, expiry: Date.now() + CACHE_TTL });
  return data;
}

export interface SkillCategory {
  key: string;
  label: string;
  icon: string;
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  { key: 'tools', label: 'Tools', icon: 'Wrench' },
  { key: 'development', label: 'Development', icon: 'Code' },
  { key: 'business', label: 'Business', icon: 'Briefcase' },
  { key: 'data-ai', label: 'Data & AI', icon: 'BrainCircuit' },
  { key: 'devops', label: 'DevOps', icon: 'Container' },
  { key: 'testing-security', label: 'Testing & Security', icon: 'ShieldCheck' },
  { key: 'documentation', label: 'Documentation', icon: 'FileText' },
  { key: 'content-media', label: 'Content & Media', icon: 'Image' },
  { key: 'research', label: 'Research', icon: 'FlaskConical' },
  { key: 'databases', label: 'Databases', icon: 'Database' },
  { key: 'lifestyle', label: 'Lifestyle', icon: 'Heart' },
  { key: 'blockchain', label: 'Blockchain', icon: 'Link' },
];
