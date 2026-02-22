import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, ChevronRight, Search, Grid3X3 } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';
import { searchSkills, SkillsmpSkill, SkillCategory } from '../api/skillsmpApi';
import CategoriesDrawer from '../components/skills/CategoriesDrawer';

const CARD_COLORS = ['#D1FAE5', '#DBEAFE', '#FEF3C7', '#FCE7F3', '#F3E8FF', '#FED7AA', '#CCFBF1', '#E0E7FF'];

function getCardColor(index: number): string {
  return CARD_COLORS[index % CARD_COLORS.length];
}

export default function SkillsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const [query, setQuery] = useState('');
  const [skills, setSkills] = useState<SkillsmpSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null);

  const doSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const result = await searchSkills(searchQuery, 1, 20, 'stars');
      setSkills(result.skills ?? []);
    } catch (e) {
      console.log('[skills] search error:', e);
      setSkills([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load popular skills on mount
  useEffect(() => {
    doSearch('');
  }, [doSearch]);

  const handleSearch = () => {
    setActiveCategory(null);
    setActiveCategoryLabel(null);
    doSearch(query);
  };

  const handleCategorySelect = (cat: SkillCategory) => {
    setActiveCategory(cat.key);
    setActiveCategoryLabel(cat.label);
    setQuery(cat.label);
    doSearch(cat.label);
  };

  const handleClearCategory = () => {
    setActiveCategory(null);
    setActiveCategoryLabel(null);
    setQuery('');
    doSearch('');
  };

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
        <Text style={localStyles.headerTitle}>Skills</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
        <Text style={localStyles.pageTitle}>Skills</Text>
        <Text style={localStyles.pageDescription}>
          Ready-made setups that teach your assistant new tricks. Pick one — and it will guide you through everything.
        </Text>

        {/* Search bar */}
        <View style={localStyles.searchRow}>
          <View style={localStyles.searchContainer}>
            <Search size={18} color="#8B8B8B" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              placeholder="Search skills..."
              placeholderTextColor="#8B8B8B"
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
          <View style={{ gap: 10, marginTop: 4 }}>
            {skills.map((skill, index) => (
              <Pressable key={skill.id || skill.slug || index} style={localStyles.skillCard}>
                <View style={[localStyles.skillIcon, { backgroundColor: getCardColor(index) }]}>
                  <Text style={{ fontSize: 22 }}>{skill.icon || '\u2728'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={localStyles.skillTitle}>{skill.name}</Text>
                  <Text style={localStyles.skillDesc} numberOfLines={2}>{skill.description}</Text>
                  {skill.author && (
                    <Text style={localStyles.skillAuthor}>{skill.author}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  {skill.stars != null && (
                    <Text style={localStyles.skillStars}>{'\u2B50'} {skill.stars}</Text>
                  )}
                  <ChevronRight size={18} color="#D1D5DB" />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Categories drawer */}
      <CategoriesDrawer
        visible={showCategories}
        onClose={() => setShowCategories(false)}
        onSelect={handleCategorySelect}
        activeCategory={activeCategory}
      />
    </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
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
  skillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  skillIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  skillDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  skillAuthor: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
  },
  skillStars: {
    fontSize: 12,
    color: '#6B7280',
  },
});
