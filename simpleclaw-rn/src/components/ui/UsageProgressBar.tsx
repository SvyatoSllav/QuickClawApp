import React from 'react';
import { View } from 'react-native';
import { colors } from '../../config/colors';

interface UsageProgressBarProps {
  used: number;
  limit: number;
}

export default function UsageProgressBar({ used, limit }: UsageProgressBarProps) {
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  let barColor: string = colors.emerald400;
  if (percent > 90) barColor = colors.red400;
  else if (percent > 70) barColor = colors.amber500;

  return (
    <View className="h-2 rounded-full bg-zinc-800 w-full overflow-hidden">
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: 9999,
        }}
      />
    </View>
  );
}
