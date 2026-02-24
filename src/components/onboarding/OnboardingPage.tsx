import React from 'react';
import { View, Dimensions } from 'react-native';
import { Text } from '@/components/ui/text';
import { Separator } from '@/components/ui/separator';

const { width } = Dimensions.get('window');

interface OnboardingPageProps {
  title: string;
  description: string;
  index: string;
  height?: number;
}

export default function OnboardingPage({ title, description, index, height }: OnboardingPageProps) {
  return (
    <View style={{ width, height: height || undefined }} className="justify-center items-center px-8">
      <Text variant="muted" className="text-xs font-bold mb-3 text-center" style={{ letterSpacing: 2 }}>
        {index}
      </Text>

      <Text variant="h3" className="mb-3 text-center">
        {title}
      </Text>

      <Separator className="w-12 mb-4" />

      <Text variant="muted" className="text-base leading-7 text-center">
        {description}
      </Text>
    </View>
  );
}
