import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Database, Image, FileSpreadsheet, MessageSquare, Zap } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';

const MARKETPLACE_ITEMS = [
  {
    icon: Globe,
    title: 'Web Scraper',
    author: 'AwesomeClaw',
    description: 'Extract structured data from any website with intelligent parsing.',
    tag: 'Official',
  },
  {
    icon: Database,
    title: 'SQL Assistant',
    author: 'AwesomeClaw',
    description: 'Generate, optimize, and explain SQL queries from natural language.',
    tag: 'Official',
  },
  {
    icon: Image,
    title: 'Image Generator',
    author: 'Community',
    description: 'Create marketing visuals, thumbnails, and social media graphics.',
    tag: 'Popular',
  },
  {
    icon: FileSpreadsheet,
    title: 'Spreadsheet Wizard',
    author: 'Community',
    description: 'Analyze CSVs, build pivot tables, and create charts automatically.',
    tag: 'Popular',
  },
  {
    icon: MessageSquare,
    title: 'Slack Bot',
    author: 'Community',
    description: 'Connect your agent to Slack channels for team-wide AI access.',
    tag: 'New',
  },
  {
    icon: Zap,
    title: 'Zapier Bridge',
    author: 'Community',
    description: 'Trigger 5,000+ app workflows directly from your agent.',
    tag: 'New',
  },
];

const TAG_COLORS: Record<string, string> = {
  Official: 'bg-primary/20',
  Popular: 'bg-yellow-500/20',
  New: 'bg-green-500/20',
};

const TAG_TEXT_COLORS: Record<string, string> = {
  Official: 'text-primary',
  Popular: 'text-yellow-500',
  New: 'text-green-500',
};

export default function MarketplaceScreen() {
  const goBack = useNavigationStore((s) => s.goBack);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text className="text-sm font-medium">Back</Text>
        </Button>
        <Text className="font-bold text-lg ml-2">Marketplace</Text>
      </View>

      <ScrollView contentContainerClassName="px-4 pt-4 pb-12 gap-3">
        {MARKETPLACE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable key={item.title}>
              <Card className="py-0">
                <CardContent className="flex-row items-center gap-4 py-4">
                  <View className="w-10 h-10 rounded-lg bg-accent items-center justify-center">
                    <Icon size={20} color="#a1a1aa" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <Text className="font-semibold text-sm">{item.title}</Text>
                      <View className={`px-1.5 py-0.5 rounded ${TAG_COLORS[item.tag]}`}>
                        <Text className={`text-[10px] font-bold ${TAG_TEXT_COLORS[item.tag]}`}>
                          {item.tag.toUpperCase()}
                        </Text>
                      </View>
                    </View>
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
