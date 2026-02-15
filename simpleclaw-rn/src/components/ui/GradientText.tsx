import React from 'react';
import { Text, Platform } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientTextProps {
  text: string;
  fontSize?: number;
}

export default function GradientText({ text, fontSize = 28 }: GradientTextProps) {
  if (Platform.OS === 'web') {
    return (
      <Text
        style={{
          fontSize,
          fontFamily: 'Inter',
          fontWeight: '600',
          textAlign: 'center',
          // @ts-ignore - web-only CSS properties
          backgroundImage: 'linear-gradient(to bottom, #FAFAFA, #FFFFFF 50%, #CFCFCF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {text}
      </Text>
    );
  }

  return (
    <MaskedView
      maskElement={
        <Text
          style={{
            fontSize,
            fontFamily: 'Inter',
            fontWeight: '600',
            textAlign: 'center',
          }}
        >
          {text}
        </Text>
      }
    >
      <LinearGradient
        colors={['#FAFAFA', '#FFFFFF', '#CFCFCF']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Text
          style={{
            fontSize,
            fontFamily: 'Inter',
            fontWeight: '600',
            textAlign: 'center',
            opacity: 0,
          }}
        >
          {text}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}
