import React from 'react';
import { ScrollView, View } from 'react-native';
import HeaderBar from '../components/HeaderBar';
import HeroSection from './landing/HeroSection';
import ModelSelector from './landing/ModelSelector';
import ChannelSelector from './landing/ChannelSelector';
import LoginSection from './landing/LoginSection';
import ComparisonSection from './landing/ComparisonSection';
import MarqueeSection from './landing/MarqueeSection';
import Footer from '../components/Footer';
import CardFrame from '../components/ui/CardFrame';

export default function LandingScreen() {
  return (
    <ScrollView>
      <View style={{ maxWidth: 900, width: '100%', alignSelf: 'center' }}>
        <HeaderBar />
        <HeroSection />
        <View className="px-4">
          <CardFrame>
            <View className="p-6">
              <ModelSelector />
              <View className="h-8" />
              <ChannelSelector />
              <View className="h-8" />
              <LoginSection />
            </View>
          </CardFrame>
        </View>
        <ComparisonSection />
        <MarqueeSection />
        <Footer />
      </View>
    </ScrollView>
  );
}
