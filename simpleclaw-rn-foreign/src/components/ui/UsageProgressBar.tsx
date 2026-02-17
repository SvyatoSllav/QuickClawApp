import React from 'react';
import { View } from 'react-native';
import { colors } from '../../config/colors';

interface UsageProgressBarProps {
  used: number;
  limit: number;
}

export default function UsageProgressBar({ used, limit }: UsageProgressBarProps) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  let barColor: string = colors.cobalt;
  if (percent > 90) barColor = colors.error;
  else if (percent > 70) barColor = colors.warning;

  return (
    <View className="h-1 bg-divider w-full overflow-hidden">
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: barColor,
        }}
      />
    </View>
  );
}
