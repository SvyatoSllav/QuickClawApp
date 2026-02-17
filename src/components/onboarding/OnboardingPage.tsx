import React from 'react';
import { View, Dimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { Separator } from '@/components/ui/separator';

const { width } = Dimensions.get('window');

interface OnboardingPageProps {
  title: string;
  description: string;
  index: string;
}

export default function OnboardingPage({ title, description, index }: OnboardingPageProps) {
  return (
    <View style={{ width }} className="flex-1 justify-center px-8">
      <Text variant="muted" className="text-xs font-bold mb-3" style={{ letterSpacing: 2 }}>
        {index}
      </Text>

      <Text variant="h3" className="mb-3">
        {title}
      </Text>

      <Separator className="w-12 mb-4" />

      <Text variant="muted" className="text-base leading-7">
        {description}
      </Text>
    </View>
  );
}
