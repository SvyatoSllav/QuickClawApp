import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useNavigationStore } from '../stores/navigationStore';
import { sendSupportMessage } from '../api/supportApi';
import { colors } from '../config/colors';

export default function SupportScreen() {
  const { t } = useTranslation();
  const goBack = useNavigationStore((s) => s.goBack);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await sendSupportMessage(trimmed);
      Alert.alert(t('supportSentTitle'), t('supportSentMessage'));
      setMessage('');
    } catch {
      Alert.alert(t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }}>
            {t('back')}
          </Text>
        </Button>
        <Text style={localStyles.headerTitle}>{t('support')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 16 }}>
        <Card>
          <CardHeader>
            <Text style={localStyles.sectionLabel}>
              {t('supportSectionLabel')}
            </Text>
          </CardHeader>
          <CardContent style={{ gap: 16 }}>
            <Text variant="muted">{t('supportDescription')}</Text>
            <TextInput
              style={localStyles.textArea}
              placeholder={t('supportPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Button
              onPress={handleSend}
              disabled={loading || !message.trim()}
              className="w-full"
              style={{ backgroundColor: colors.primary }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {loading ? t('loading') : t('supportSend')}
              </Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D4',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
    color: '#1A1A1A',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B8B8B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E0D4',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 140,
  },
});
