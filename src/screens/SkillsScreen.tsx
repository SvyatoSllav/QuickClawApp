import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, Search, Grid3X3, Star, Download, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';
import { searchSkills, SkillsmpSkill, SkillCategory } from '../api/skillsmpApi';
import CategoriesDrawer from '../components/skills/CategoriesDrawer';
import InstallSkillModal from '../components/skills/InstallSkillModal';

const PAGE_SIZE = 5;

function formatCount(n?: number): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function formatDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toISOString().split('T')[0];
}

function getAuthorAvatar(author?: string): string | null {
  if (!author) return null;
  return `https://github.com/${author}.png?size=40`;
}

export default function SkillsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
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
      const result = await searchSkills(searchQuery, pageNum, PAGE_SIZE, 'stars');
      setSkills(result.skills ?? []);
      setTotal(result.total ?? 0);
      setPage(pageNum);
    } catch (e) {
      console.log('[skills] search error:', e);
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentQuery = activeCategoryLabel || query;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    fetchPage(currentQuery, p);
  };

  // Build page numbers to display (max 5 visible)
  const getPageNumbers = (): number[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
        <Text style={s.pageTitle}>Skills</Text>
        <Text style={s.pageDescription}>
          Ready-made setups that teach your assistant new tricks. Pick one — and it will guide you through everything.
        </Text>

        {/* Search bar */}
        <View style={s.searchRow}>
          <View style={s.searchContainer}>
            <Search size={18} color="#8B8B8B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              placeholder="Search skills..."
              placeholderTextColor="#8B8B8B"
              style={s.searchInput}
              returnKeyType="search"
            />
          </View>
          <Pressable onPress={() => setShowCategories(true)} style={s.categoriesButton}>
            <Grid3X3 size={16} color={colors.primary} />
            <Text style={s.categoriesText}>Categories</Text>
          </Pressable>
        </View>

        {/* Active category chip */}
        {activeCategoryLabel && (
          <View style={s.activeCategoryRow}>
            <Pressable onPress={handleClearCategory} style={s.activeCategoryChip}>
              <Text style={s.activeCategoryText}>{activeCategoryLabel} ×</Text>
            </Pressable>
          </View>
        )}

        {/* Results */}
        {isLoading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : skills.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyText}>
              {query ? 'No skills found' : 'Loading skills...'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginTop: 4 }}>
            {total > 0 && (
              <Text style={s.resultsCount}>
                {total} skills found
              </Text>
            )}
            {skills.map((skill, index) => (
              <SkillCard
                key={skill.id || index}
                skill={skill}
                onPress={() => {
                  setSelectedSkill(skill);
                  setShowInstallModal(true);
                }}
              />
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <View style={s.pagination}>
                <Pressable
                  onPress={() => goToPage(page - 1)}
                  disabled={page === 1}
                  style={[s.pageArrow, page === 1 && s.pageArrowDisabled]}
                >
                  <ChevronLeft size={18} color={page === 1 ? '#D1D5DB' : colors.foreground} />
                </Pressable>

                {getPageNumbers().map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => goToPage(p)}
                    style={[s.pageNumber, p === page && s.pageNumberActive]}
                  >
                    <Text style={[s.pageNumberText, p === page && s.pageNumberTextActive]}>
                      {p}
                    </Text>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  style={[s.pageArrow, page === totalPages && s.pageArrowDisabled]}
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

function SkillCard({ skill, onPress }: { skill: SkillsmpSkill; onPress?: () => void }) {
  const avatarUri = getAuthorAvatar(skill.author);

  return (
    <Pressable style={s.card} onPress={onPress}>
      {/* Card header — skill name + stars */}
      <View style={s.cardHeader}>
        <Text style={s.cardHeaderName} numberOfLines={1}>
          {skill.name}
        </Text>
        {skill.stars != null && (
          <View style={s.cardStatsInline}>
            <Star size={12} color="#F59E0B" />
            <Text style={s.cardStatText}>{formatCount(skill.stars)}</Text>
          </View>
        )}
      </View>

      {/* Card body */}
      <View style={s.cardBody}>
        {/* Skill name — large */}
        <Text style={s.cardSkillName} numberOfLines={1}>
          {skill.name}
        </Text>

        {/* Author */}
        {skill.author && (
          <View style={s.authorRow}>
            {avatarUri && (
              <Image source={{ uri: avatarUri }} style={s.authorAvatar} />
            )}
            <Text style={s.authorName}>{skill.author}</Text>
          </View>
        )}

        {/* Description */}
        <Text style={s.cardDesc} numberOfLines={2}>
          {skill.description}
        </Text>

        {/* Bottom row: date + installs */}
        <View style={s.cardMeta}>
          {skill.updatedAt ? (
            <Text style={s.cardMetaText}>{formatDate(skill.updatedAt)}</Text>
          ) : null}
          {skill.installs != null && (
            <View style={s.cardMetaItem}>
              <Download size={12} color="#9CA3AF" />
              <Text style={s.cardMetaText}>{formatCount(skill.installs)}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
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
    color: '#1A1A1A',
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
    borderColor: '#E8E0D4',
    paddingHorizontal: 12,
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
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
    color: '#8B8B8B',
  },
  resultsCount: {
    fontSize: 13,
    color: '#8B8B8B',
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
    color: '#1A1A1A',
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
