import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput, ActivityIndicator, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, Search, Grid3X3, Heart } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';
import { searchSkills, SkillsmpSkill, SkillCategory } from '../api/skillsmpApi';
import CategoriesDrawer from '../components/skills/CategoriesDrawer';
import InstallSkillModal from '../components/skills/InstallSkillModal';

function formatStars(n: number): string {
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

// Traffic-light dot colors for the terminal title bar
const DOT_COLORS = ['#FF5F57', '#FEBC2E', '#28C840'];

export default function SkillsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const [query, setQuery] = useState('');
  const [skills, setSkills] = useState<SkillsmpSkill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillsmpSkill | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

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
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Skills</Text>
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
      {/* Title bar — terminal style */}
      <View style={s.cardTitleBar}>
        <View style={s.cardDots}>
          {DOT_COLORS.map((c) => (
            <View key={c} style={[s.dot, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={s.cardFileName} numberOfLines={1}>
          {skill.name}.md
        </Text>
        {skill.stars != null && (
          <Text style={s.cardStars}>{'\u2B50'} {formatStars(skill.stars)}</Text>
        )}
      </View>

      {/* Body */}
      <View style={s.cardBody}>
        {/* Author row */}
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
      </View>

      {/* Footer */}
      <View style={s.cardFooter}>
        <Text style={s.cardDate}>{formatDate(skill.updatedAt)}</Text>
        <Heart size={14} color="#D1D5DB" />
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

  // Card — terminal style
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardTitleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240,232,220,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  cardDots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  cardFileName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#6B7280',
  },
  cardStars: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  authorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  cardDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 20,
    marginTop: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(240,232,220,0.2)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardDate: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#9CA3AF',
  },
});
