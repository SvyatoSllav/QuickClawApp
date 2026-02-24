import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, Search, Grid3X3, Star, Download, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { useAgentStore } from '../stores/agentStore';
import { colors } from '../config/colors';
import { PAGINATION } from '../config/constants';
import { formatCount, formatCompactDate } from '../utils/formatters';
import { searchSkills, SkillsmpSkill, SkillCategory } from '../api/skillsmpApi';
import CategoriesDrawer from '../components/skills/CategoriesDrawer';
import InstallSkillModal from '../components/skills/InstallSkillModal';

function getAuthorAvatar(author?: string): string | null {
  if (!author) return null;
  return `https://github.com/${author}.png?size=40`;
}

export default function SkillsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const agents = useAgentStore((s) => s.agents);

  // Set of skill names installed on at least one agent
  const installedSkills = useMemo(() => {
    const set = new Set<string>();
    for (const agent of agents) {
      for (const s of agent.skills ?? []) {
        set.add(s);
      }
    }
    return set;
  }, [agents]);

  const [query, setQuery] = useState('');
  const [skills, setSkills] = useState<SkillsmpSkill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillsmpSkill | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const fetchPage = useCallback(async (searchQuery: string, pageNum: number) => {
    setIsLoading(true);
    try {
      const result = await searchSkills(searchQuery, pageNum, PAGINATION.SKILLS_PAGE_SIZE, 'stars');
      setSkills(result.skills ?? []);
      setTotal(result.total ?? 0);
      setPage(pageNum);
    } catch (e) {
      if (__DEV__) console.log('[skills] search error:', e);
      setSkills([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage('', 1);
  }, [fetchPage]);

  const handleSearch = () => {
    setActiveCategory(null);
    setActiveCategoryLabel(null);
    fetchPage(query, 1);
  };

  const handleCategorySelect = (cat: SkillCategory) => {
    setActiveCategory(cat.key);
    setActiveCategoryLabel(cat.label);
    setQuery(cat.label);
    fetchPage(cat.label, 1);
  };

  const handleClearCategory = () => {
    setActiveCategory(null);
    setActiveCategoryLabel(null);
    setQuery('');
    fetchPage('', 1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGINATION.SKILLS_PAGE_SIZE));
  const currentQuery = activeCategoryLabel || query;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    fetchPage(currentQuery, p);
  };

  // Build page numbers to display
  const pageNumbers = useMemo((): number[] => {
    const max = PAGINATION.MAX_VISIBLE_PAGES;
    if (totalPages <= max) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(max / 2);
    if (page <= half + 1) return Array.from({ length: max }, (_, i) => i + 1);
    if (page >= totalPages - half) return Array.from({ length: max }, (_, i) => totalPages - max + 1 + i);
    return Array.from({ length: max }, (_, i) => page - half + i);
  }, [totalPages, page]);

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
        <Text style={localStyles.pageTitle}>Skills</Text>
        <Text style={localStyles.pageDescription}>
          Ready-made setups that teach your assistant new tricks. Pick one — and it will guide you through everything.
        </Text>

        {/* Search bar */}
        <View style={localStyles.searchRow}>
          <View style={localStyles.searchContainer}>
            <Search size={18} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              placeholder="Search skills..."
              placeholderTextColor={colors.mutedForeground}
              style={localStyles.searchInput}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={() => setShowCategories(true)} style={localStyles.categoriesButton}>
            <Grid3X3 size={16} color={colors.primary} />
            <Text style={localStyles.categoriesText}>Categories</Text>
          </Pressable>
        </View>

        {/* Active category chip */}
        {activeCategoryLabel && (
          <View style={localStyles.activeCategoryRow}>
            <Pressable onPress={handleClearCategory} style={localStyles.activeCategoryChip}>
              <Text style={localStyles.activeCategoryText}>{activeCategoryLabel} ×</Text>
            </Pressable>
          </View>
        )}

        {/* Results */}
        {isLoading ? (
          <View style={localStyles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : skills.length === 0 ? (
          <View style={localStyles.emptyContainer}>
            <Text style={localStyles.emptyText}>
              {query ? 'No skills found' : 'Loading skills...'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 4 }}>
            {total > 0 && (
              <Text style={localStyles.resultsCount}>
                {total} skills found
              </Text>
            )}
            {skills.map((skill, index) => (
              <SkillCard
                key={skill.id || index}
                skill={skill}
                isInstalled={installedSkills.has(skill.name)}
                onPress={() => {
                  setSelectedSkill(skill);
                  setShowInstallModal(true);
                }}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={localStyles.pagination}>
                <Pressable
                  onPress={() => goToPage(page - 1)}
                  disabled={page === 1}
                  style={[localStyles.pageArrow, page === 1 && localStyles.pageArrowDisabled]}
                >
                  <ChevronLeft size={18} color={page === 1 ? '#D1D5DB' : colors.foreground} />
                </Pressable>

                {pageNumbers.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => goToPage(p)}
                    style={[localStyles.pageNumber, p === page && localStyles.pageNumberActive]}
                  >
                    <Text style={[localStyles.pageNumberText, p === page && localStyles.pageNumberTextActive]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  style={[localStyles.pageArrow, page === totalPages && localStyles.pageArrowDisabled]}
                >
                  <ChevronRight size={18} color={page === totalPages ? '#D1D5DB' : colors.foreground} />
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <CategoriesDrawer
        visible={showCategories}
        onClose={() => setShowCategories(false)}
        onSelect={handleCategorySelect}
        activeCategory={activeCategory}
      />

      <InstallSkillModal
        visible={showInstallModal}
        skill={selectedSkill}
        onClose={() => setShowInstallModal(false)}
      />
    </View>
  );
}

function SkillCard({ skill, isInstalled, onPress }: { skill: SkillsmpSkill; isInstalled?: boolean; onPress?: () => void }) {
  const avatarUri = getAuthorAvatar(skill.author);

  return (
    <Pressable style={localStyles.card} onPress={onPress}>
      {/* Card header — skill name + stars */}
      <View style={localStyles.cardHeader}>
        <Text style={localStyles.cardHeaderName} numberOfLines={1}>
          {skill.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isInstalled && (
            <View style={localStyles.installedBadge}>
              <CheckCircle size={12} color="#16A34A" />
              <Text style={localStyles.installedText}>Installed</Text>
            </View>
          )}
          {skill.stars != null && (
            <View style={localStyles.cardStatsInline}>
              <Star size={12} color="#F59E0B" />
              <Text style={localStyles.cardStatText}>{formatCount(skill.stars)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Card body */}
      <View style={localStyles.cardBody}>
        {/* Skill name — large */}
        <Text style={localStyles.cardSkillName} numberOfLines={1}>
          {skill.name}
        </Text>

        {/* Author */}
        {skill.author && (
          <View style={localStyles.authorRow}>
            {avatarUri && (
              <Image source={{ uri: avatarUri }} style={localStyles.authorAvatar} />
            )}
            <Text style={localStyles.authorName}>{skill.author}</Text>
          </View>
        )}

        {/* Description */}
        <Text style={localStyles.cardDesc} numberOfLines={2}>
          {skill.description}
        </Text>

        {/* Bottom row: date + installs */}
        <View style={localStyles.cardMeta}>
          {skill.updatedAt ? (
            <Text style={localStyles.cardMetaText}>{formatCompactDate(skill.updatedAt)}</Text>
          ) : null}
          {skill.installs != null && (
            <View style={localStyles.cardMetaItem}>
              <Download size={12} color="#9CA3AF" />
              <Text style={localStyles.cardMetaText}>{formatCount(skill.installs)}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  pageDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    paddingVertical: 0,
  },
  categoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  categoriesText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  activeCategoryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  activeCategoryChip: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  activeCategoryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  resultsCount: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontWeight: '500',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  pageArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageArrowDisabled: {
    opacity: 0.4,
  },
  pageNumber: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageNumberActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  pageNumberTextActive: {
    color: '#FFFFFF',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F6F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardHeaderName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#6B7280',
    marginRight: 8,
  },
  installedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  installedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  cardStatsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  cardSkillName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  cardDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
