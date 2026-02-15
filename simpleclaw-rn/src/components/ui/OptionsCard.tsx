import React from 'react';
import { Pressable, View } from 'react-native';

interface OptionsCardProps {
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

export default function OptionsCard({ selected, disabled, onPress, children }: OptionsCardProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <View
        className={`px-4 py-3 rounded-xl border ${
          selected ? 'bg-zinc-900 border-zinc-600' : 'bg-zinc-900/50 border-zinc-800'
        }`}
      >
        {children}
      </View>
    </Pressable>
  );
}
