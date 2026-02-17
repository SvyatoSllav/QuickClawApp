import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../config/colors';

interface SpinnerIconProps {
  size?: number;
  color?: string;
}

export default function SpinnerIcon({ size = 24, color = colors.primary }: SpinnerIconProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const borderWidth = Math.max(2, size * 0.1);

  return (
    <Animated.View style={[animatedStyle, { width: size, height: size }]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: color,
        }}
      />
    </Animated.View>
  );
}
