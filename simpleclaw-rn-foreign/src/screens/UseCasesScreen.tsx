import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '../stores/navigationStore';

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
      <View className="flex-1 items-center justify-center px-6">
        <Text variant="h3" className="text-center mb-2">Use Cases</Text>
        <Text variant="muted" className="text-center">Coming soon</Text>
      </View>
    </View>
  );
}
