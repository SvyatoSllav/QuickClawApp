import React from 'react';
import { View } from 'react-native';

interface CardFrameProps {
  children: React.ReactNode;
}

export default function CardFrame({ children }: CardFrameProps) {
  return (
    <View className="p-2 rounded-3xl border-2 border-white/[0.08]"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.42, shadowRadius: 32, elevation: 8 }}>
      <View className="bg-background rounded-2xl border border-white/[0.05] overflow-hidden">
        {children}
      </View>
    </View>
  );
}
