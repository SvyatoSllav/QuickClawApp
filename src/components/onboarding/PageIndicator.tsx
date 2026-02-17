import React from 'react';
import { View } from 'react-native';

interface PageIndicatorProps {
  total: number;
  current: number;
}

export default function PageIndicator({ total, current }: PageIndicatorProps) {
  return (
    <View className="flex-row items-center justify-center gap-2 mb-2">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={
            i === current
              ? 'w-8 h-1 rounded-full bg-foreground'
              : 'w-2 h-1 rounded-full bg-muted'
          }
        />
      ))}
    </View>
  );
}
