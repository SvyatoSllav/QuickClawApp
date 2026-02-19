import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';

const SYSTEM_PROMPTS = [
  {
    id: 'default',
    title: 'Default Assistant',
    preview: 'You are a helpful AI assistant. Be concise, accurate, and friendly.',
  },
  {
    id: 'marketer',
    title: 'Marketing Expert',
    preview: 'You are a senior digital marketing strategist with 15 years of experience in growth, SEO, and paid acquisition.',
  },
  {
    id: 'analyst',
    title: 'Data Analyst',
    preview: 'You are a data analyst specializing in business intelligence. Always back claims with numbers and suggest visualizations.',
  },
  {
    id: 'copywriter',
    title: 'Copywriter',
    preview: 'You are an award-winning copywriter. Write punchy, conversion-focused copy. Keep sentences short and impactful.',
  },
  {
    id: 'developer',
    title: 'Developer',
    preview: 'You are a senior full-stack developer. Write clean, production-ready code with proper error handling.',
  },
  {
    id: 'support',
    title: 'Support Agent',
    preview: 'You are a friendly customer support agent. Be empathetic, resolve issues quickly, and escalate when needed.',
  },
];

export default function SystemPromptsScreen() {
  const goBack = useNavigationStore((s) => s.goBack);
  const [activePrompt, setActivePrompt] = useState('default');

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text className="text-sm font-medium">Back</Text>
        </Button>
        <Text className="font-bold text-lg ml-2">System Prompts</Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pt-4 pb-12 gap-3">
        <Text variant="muted" className="text-xs mb-1 px-1">
          Choose a persona for your agent. This sets the system prompt for all conversations.
        </Text>

        {SYSTEM_PROMPTS.map((prompt) => {
          const isActive = activePrompt === prompt.id;
          return (
            <Pressable key={prompt.id} onPress={() => setActivePrompt(prompt.id)}>
              <Card className={`py-0 ${isActive ? 'border-primary' : ''}`}>
                <CardContent className="py-4">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-semibold text-sm">{prompt.title}</Text>
                    {isActive && (
                      <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text variant="muted" className="text-xs leading-5" numberOfLines={2}>
                    {prompt.preview}
                  </Text>
                </CardContent>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
