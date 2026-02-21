import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, ChevronRight } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'communication', label: 'Communication' },
];

interface Skill {
  emoji: string;
  title: string;
  description: string;
  bgColor: string;
  category: string;
}

const SKILLS: Skill[] = [
  {
    emoji: '\uD83D\uDD0D',
    title: 'Research for me (Web Search)',
    description: 'Set up and use OpenClaw web search with Brave Search API so you...',
    bgColor: '#D1FAE5',
    category: 'productivity',
  },
  {
    emoji: '\uD83D\uDCC5',
    title: 'Plan my day (Google Calendar)',
    description: 'Connect your Google Calendar and let your assistant manage events, sc...',
    bgColor: '#DBEAFE',
    category: 'productivity',
  },
  {
    emoji: '\uD83D\uDCCB',
    title: 'Track my tasks (Trello)',
    description: 'Set up Trello to organize your to-do lists, track projects, and stay on top o...',
    bgColor: '#FEF3C7',
    category: 'productivity',
  },
  {
    emoji: '\uD83D\uDCE8',
    title: 'Automate TikTok Marketing (Larry)',
    description: 'Automate TikTok slideshow marketing for any app or product wit...',
    bgColor: '#FCE7F3',
    category: 'marketing',
  },
  {
    emoji: '\uD83D\uDCC8',
    title: 'B2C Mobile App Marketing (Jack Friks)',
    description: 'Set up Jack Friks B2C mobile app marketing strategy with growth hacki...',
    bgColor: '#F3E8FF',
    category: 'marketing',
  },
  {
    emoji: '\u2709\uFE0F',
    title: 'Email Automation (Mailchimp)',
    description: 'Connect Mailchimp to automate email campaigns, newsletters, and drip seq...',
    bgColor: '#DBEAFE',
    category: 'communication',
  },
];

export default function SkillsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = activeCategory === 'all'
    ? SKILLS
    : SKILLS.filter((s) => s.category === activeCategory);

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

        {/* Filter chips */}
        <View style={localStyles.chipsRow}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => setActiveCategory(cat.key)}
              style={[
                localStyles.chip,
                activeCategory === cat.key && localStyles.chipActive,
              ]}
            >
              <Text
                style={[
                  localStyles.chipText,
                  activeCategory === cat.key && localStyles.chipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 10, marginTop: 4 }}>
          {filtered.map((skill) => (
            <Pressable key={skill.title} style={localStyles.skillCard}>
              <View style={[localStyles.skillIcon, { backgroundColor: skill.bgColor }]}>
                <Text style={{ fontSize: 22 }}>{skill.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.skillTitle}>{skill.title}</Text>
                <Text style={localStyles.skillDesc} numberOfLines={2}>{skill.description}</Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
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
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E0D4',
  },
  chipActive: {
    backgroundColor: '#F5A623',
    borderColor: '#F5A623',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
});
