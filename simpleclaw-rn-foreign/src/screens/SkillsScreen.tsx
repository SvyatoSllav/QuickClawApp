import React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, ChevronDown } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';

const SKILLS = [
  {
    emoji: '\uD83D\uDD0D',
    title: 'Research for me (Web Search)',
    description: 'Set up and use OpenClaw web search with Brave Search API so you...',
    bgColor: '#D1FAE5',
  },
  {
    emoji: '\uD83D\uDCC5',
    title: 'Plan my day (Google Calendar)',
    description: 'Connect your Google Calendar and let your assistant manage events, sc...',
    bgColor: '#DBEAFE',
  },
  {
    emoji: '\uD83D\uDCCB',
    title: 'Track my tasks (Trello)',
    description: 'Set up Trello to organize your to-do lists, track projects, and stay on top o...',
    bgColor: '#FEF3C7',
  },
  {
    emoji: '\uD83D\uDCE8',
    title: 'Automate TikTok Marketing (Larry)',
    description: 'Automate TikTok slideshow marketing for any app or product wit...',
    bgColor: '#FCE7F3',
  },
  {
    emoji: '\uD83D\uDCC8',
    title: 'B2C Mobile App Marketing (Jack Friks)',
    description: 'Set up Jack Friks B2C mobile app marketing strategy with growth hacki...',
    bgColor: '#F3E8FF',
  },
  {
    emoji: '\u2709\uFE0F',
    title: 'Email Automation (Mailchimp)',
    description: 'Connect Mailchimp to automate email campaigns, newsletters, and drip seq...',
    bgColor: '#DBEAFE',
  },
];

export default function SkillsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
        <Text style={localStyles.headerTitle}>{'\u041D\u0430\u0432\u044B\u043A\u0438'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
        <Text style={localStyles.pageTitle}>{'\u041D\u0430\u0432\u044B\u043A\u0438'}</Text>
        <Text style={localStyles.pageDescription}>
          {'\u0413\u043E\u0442\u043E\u0432\u044B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0430\u0443\u0447\u0430\u0442 \u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442\u0430 \u043D\u043E\u0432\u044B\u043C \u0442\u0440\u044E\u043A\u0430\u043C. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u0434\u0438\u043D \u2014 \u0438 \u043E\u043D \u043F\u0440\u043E\u0432\u0435\u0434\u0451\u0442 \u0432\u0430\u0441 \u0447\u0435\u0440\u0435\u0437 \u0432\u0441\u0451.'}
        </Text>

        <View style={{ gap: 10, marginTop: 8 }}>
          {SKILLS.map((skill) => (
            <Pressable key={skill.title} style={localStyles.skillCard}>
              <View style={[localStyles.skillIcon, { backgroundColor: skill.bgColor }]}>
                <Text style={{ fontSize: 22 }}>{skill.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.skillTitle}>{skill.title}</Text>
                <Text style={localStyles.skillDesc} numberOfLines={2}>{skill.description}</Text>
              </View>
              <ChevronDown size={18} color="#D1D5DB" />
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
