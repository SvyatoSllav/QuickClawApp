import React from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { useAgentStore } from '../stores/agentStore';
import { colors } from '../config/colors';

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  researcher: 'Web research, news monitoring, competitive intelligence, and multi-source information synthesis.',
  writer: 'Articles, social media, email campaigns, video scripts, and image generation for visual content.',
  coder: 'Code generation, debugging, architecture design, Git workflows, and background coding agents.',
  analyst: 'Data exploration, statistical analysis, report generation, dashboards, and Google Sheets integration.',
  assistant: 'Task management, calendar, email, reminders, and workflow automation across Trello, Notion, and Google.',
};

export default function AgentsScreen() {
  const goBack = useNavigationStore((s) => s.goBack);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const switchAgent = useAgentStore((s) => s.switchAgent);
  const isLoading = useAgentStore((s) => s.isLoading);

  const handleSelect = (id: string) => {
    switchAgent(id);
    setScreen('chat');
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text className="text-sm font-medium">Back</Text>
        </Button>
        <Text className="font-bold text-lg ml-2">Agents</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-4 pt-4 pb-12 gap-3">
          <Text variant="muted" className="text-xs mb-1 px-1">
            Switch between specialized agents. Each agent has its own persona, tools, and session history.
          </Text>

          {agents.map((agent) => {
            const isActive = activeAgentId === agent.id;
            const emoji = agent.identity?.emoji ?? '';
            const name = agent.identity?.name ?? agent.name ?? agent.id;
            const description = agent.description || FALLBACK_DESCRIPTIONS[agent.id] || '';
            const skills = agent.skills ?? [];

            return (
              <Pressable key={agent.id} onPress={() => handleSelect(agent.id)}>
                <Card className={`py-0 ${isActive ? 'border-primary' : ''}`}>
                  <CardContent className="py-4">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-lg">{emoji}</Text>
                        <Text className="font-semibold text-sm">{name}</Text>
                      </View>
                      {isActive && (
                        <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                          <Check size={12} color="#fff" strokeWidth={3} />
                        </View>
                      )}
                    </View>
                    {description ? (
                      <Text variant="muted" className="text-xs leading-5 ml-8" numberOfLines={2}>
                        {description}
                      </Text>
                    ) : null}
                    {skills.length > 0 && (
                      <View className="flex-row flex-wrap gap-1.5 ml-8 mt-2">
                        {skills.map((skill) => (
                          <View key={skill} className="bg-muted rounded-full px-2.5 py-0.5">
                            <Text className="text-[10px] text-muted-foreground">{skill}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </CardContent>
                </Card>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
