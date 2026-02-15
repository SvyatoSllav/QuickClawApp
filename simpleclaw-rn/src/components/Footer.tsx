import React from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../config/appConfig';

function FooterLink({ text, color, onPress }: { text: string; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Text style={{ color: color || '#A1A1AA', fontSize: 14 }}>{text}</Text>
    </Pressable>
  );
}

function Dot() {
  return <View className="w-1 h-1 rounded-full bg-white/60 mx-1.5" />;
}

export default function Footer() {
  const { t } = useTranslation();
  const openArticle = (path: string) => Linking.openURL(`${AppConfig.frontendUrl}${path}`);
  const openMail = () => Linking.openURL(`mailto:${AppConfig.supportEmail}`);

  return (
    <View className="px-4 pt-12 pb-8">
      <View className="flex-row flex-wrap justify-center items-center">
        <FooterLink text={t('articleInstall')} onPress={() => openArticle('/articles/how-to-install-openclaw.html')} />
        <Dot />
        <FooterLink text={t('articleWhat')} onPress={() => openArticle('/articles/what-is-openclaw.html')} />
        <Dot />
        <FooterLink text={t('articleTop5')} onPress={() => openArticle('/articles/top-5-ways-to-use-openclaw.html')} />
      </View>
      <View className="h-6" />
      <View className="flex-row flex-wrap justify-center items-center">
        <Text className="text-white font-medium text-sm">{t('author')}</Text>
        <Dot />
        <FooterLink text={t('contact')} color="#FFFFFF" onPress={openMail} />
        <Dot />
        <FooterLink text={t('agreement')} onPress={() => openArticle('/agreement.html')} />
        <Dot />
        <FooterLink text={t('privacyPolicy')} onPress={() => openArticle('/privacy.html')} />
      </View>
    </View>
  );
}
