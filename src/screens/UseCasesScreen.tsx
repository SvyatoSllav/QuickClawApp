import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, BarChart3, Mail, PenTool, Search, Users } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';

const USE_CASES = [
  {
    icon: Megaphone,
    title: 'Marketing Campaigns',
    description: 'Launch and manage multi-channel campaigns with AI-driven copy and targeting.',
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description: 'Analyze revenue data, spot trends, and generate reports in minutes.',
  },
  {
    icon: Mail,
    title: 'Email Automation',
    description: 'Draft, schedule, and send personalized email sequences at scale.',
  },
  {
    icon: PenTool,
    title: 'Content Creation',
    description: 'Generate blog posts, social media copy, and ad creatives on demand.',
  },
  {
    icon: Search,
    title: 'Competitor Research',
    description: 'Track competitor activity, pricing changes, and market positioning.',
  },
  {
    icon: Users,
    title: 'Customer Support',
    description: 'Automate ticket triage, draft responses, and resolve issues faster.',
  },
];

export default function UseCasesScreen() {
  const goBack = useNavigationStore((s) => s.goBack);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text className="text-sm font-medium">Back</Text>
        </Button>
        <Text className="font-bold text-lg ml-2">Use Cases</Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pt-4 pb-12 gap-3">
        {USE_CASES.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable key={item.title}>
              <Card className="py-0">
                <CardContent className="flex-row items-center gap-4 py-4">
                  <View className="w-10 h-10 rounded-lg bg-accent items-center justify-center">
                    <Icon size={20} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-sm mb-0.5">{item.title}</Text>
                    <Text variant="muted" className="text-xs leading-5">{item.description}</Text>
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
