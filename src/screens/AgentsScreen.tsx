import React, { useEffect } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, ChevronRight } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { useAgentStore } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';
import { colors } from '../config/colors';

const AGENT_EMOJIS: Record<string, string> = {
  coder: '\uD83D\uDCBB',
  researcher: '\uD83D\uDD0D',
  writer: '\u270D\uFE0F',
  analyst: '\uD83D\uDCCA',
  assistant: '\uD83E\uDD16',
};

const EMOJI_BG_COLORS: Record<string, string> = {
  coder: '#DBEAFE',
  researcher: '#FEF3C7',
  writer: '#FCE7F3',
  analyst: '#D1FAE5',
  assistant: '#F3E8FF',
};

const POPULAR_AGENTS = new Set(['coder', 'analyst', 'researcher']);

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  researcher: 'Web research, news monitoring, competitive intelligence.',
  writer: 'Creates engaging marketing copy, landing pages, and product descriptions.',
  coder: 'Full-stack dev helper. Writes, reviews, and debugs code across languages.',
  analyst: 'Analyzes data, builds queries, and creates insightful reports.',
  assistant: 'Task management, calendar, email, reminders, and workflow automation.',
};

export default function AgentsScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const switchAgent = useAgentStore((s) => s.switchAgent);
  const isLoading = useAgentStore((s) => s.isLoading);
  const connectionState = useChatStore((s) => s.connectionState);

  // Fetch agents if store is empty but WS is connected
  useEffect(() => {
    if (agents.length === 0 && !isLoading && connectionState === 'connected') {
      console.log('[agents-screen] Agents empty, fetching...');
      fetchAgents();
    }
  }, [agents.length, isLoading, connectionState]);

  const handleSelect = (id: string) => {
    switchAgent(id);
    setScreen('chat');
  };

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
          <Text style={localStyles.pageTitle}>Choose an agent</Text>
          <Text style={localStyles.pageSubtitle}>
            Pre-configured agents for specific tasks
          </Text>

          {/* Agent cards */}
          <View style={{ gap: 10, marginTop: 16 }}>
            {agents.map((agent) => {
              const emoji = agent.identity?.emoji ?? AGENT_EMOJIS[agent.id] ?? '\uD83E\uDD16';
              const name = agent.identity?.name ?? agent.name ?? agent.id;
              const description = agent.description || FALLBACK_DESCRIPTIONS[agent.id] || '';
              const bgColor = EMOJI_BG_COLORS[agent.id] ?? '#F3F4F6';
              const isPopular = POPULAR_AGENTS.has(agent.id);

              return (
                <Pressable
                  key={agent.id}
                  onPress={() => handleSelect(agent.id)}
                  style={localStyles.agentCard}
                >
                  <View style={[localStyles.emojiCircle, { backgroundColor: bgColor }]}>
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <Text style={localStyles.agentName}>{name}</Text>
                      {isPopular && (
                        <View style={localStyles.popularBadge}>
                          <Text style={localStyles.popularBadgeText}>Popular</Text>
                        </View>
                      )}
                    </View>
                    {description ? (
                      <Text style={localStyles.agentDesc} numberOfLines={2}>{description}</Text>
                    ) : null}
                  </View>
                  <ChevronRight size={18} color="#D1D5DB" />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8B8B8B',
  },
  agentCard: {
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
  emojiCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  agentDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  popularBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F5A623',
  },
});
