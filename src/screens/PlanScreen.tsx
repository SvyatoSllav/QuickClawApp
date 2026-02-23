import React, { useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useDeployStore } from '../stores/deployStore';
import { colors } from '../config/colors';

const FEATURES = [
  'planFeature1',
  'planFeature2',
  'planFeature3',
  'planFeature4',
] as const;

function formatPeriod(periodUnit: string | undefined): string {
  switch (periodUnit) {
    case 'MONTH': return '/mo';
    case 'YEAR': return '/yr';
    case 'WEEK': return '/wk';
    default: return '';
  }
}

function PackageCard({
  pkg,
  selected,
  onSelect,
  t,
}: {
  pkg: any;
  selected: boolean;
  onSelect: () => void;
  t: (key: string) => string;
}) {
  const product = pkg.product;
  const period = formatPeriod(product.subscriptionPeriod?.unit);

  return (
    <Pressable onPress={onSelect}>
      <Card
        style={[
          styles.card,
          selected && styles.cardSelected,
        ]}
      >
        <CardContent className="gap-3" style={{ paddingTop: 20 }}>
          <View className="flex-row items-center justify-between">
            <Text style={styles.packageType}>
              {pkg.packageType}
            </Text>
            {selected && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>Selected</Text>
              </View>
            )}
          </View>

          <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
            {product.title || t('planName')}
          </Text>

          <View className="flex-row items-baseline">
            <Text className="text-4xl font-black" style={{ letterSpacing: -1.5, color: colors.foreground }}>
              {product.priceString}
            </Text>
            <Text style={{ fontSize: 16, marginLeft: 4, color: '#8B8B8B' }}>
              {period}
            </Text>
          </View>

          {product.description ? (
            <Text variant="muted" className="text-sm">{product.description}</Text>
          ) : null}
        </CardContent>
      </Card>
    </Pressable>
  );
}

export default function PlanScreen() {
  const { t } = useTranslation();
  const packages = useSubscriptionStore((s) => s.packages);
  const selectedPackage = useSubscriptionStore((s) => s.selectedPackage);
  const selectPackage = useSubscriptionStore((s) => s.selectPackage);
  const loadOfferings = useSubscriptionStore((s) => s.loadOfferings);
  const purchaseSelected = useSubscriptionStore((s) => s.purchaseSelected);
  const webPurchase = useSubscriptionStore((s) => s.webPurchase);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const loading = useSubscriptionStore((s) => s.loading);
  const error = useSubscriptionStore((s) => s.error);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const goBack = useNavigationStore((s) => s.goBack);

  useEffect(() => {
    console.log('[PlanScreen] mounted, calling loadOfferings()');
    loadOfferings();
  }, []);

  console.log('[PlanScreen] render — packages:', packages.length, 'selectedPackage:', selectedPackage?.identifier ?? 'null', 'loading:', loading, 'error:', error, 'buttonDisabled:', loading || (!selectedPackage && packages.length > 0));

  const handleSubscribe = async () => {
    const isWeb = Platform.OS === 'web';
    console.log('[PlanScreen] handleSubscribe called — platform:', Platform.OS, 'branch:', isWeb ? 'webPurchase' : 'purchaseSelected');
    const success = isWeb
      ? await webPurchase()
      : await purchaseSelected();
    console.log('[PlanScreen] handleSubscribe result:', success);
    if (success) {
      console.log('[PlanScreen] Purchase succeeded, checking deploy status...');
      await useDeployStore.getState().checkStatus();
      console.log('[PlanScreen] Navigating to chat');
      setScreen('chat');
    } else {
      console.log('[PlanScreen] Purchase failed or cancelled');
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      await useDeployStore.getState().checkStatus();
      setScreen('chat');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }}>{t('back')}</Text>
        </Button>
        <Text style={styles.headerTitle}>{t('planTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} style={{ flex: 1 }}>
        <Text style={styles.sectionLabel}>ACCESS</Text>

        <Text variant="h3" className="mb-2" style={{ color: colors.foreground }}>
          {t('planTitle')}
        </Text>
        <Text variant="muted" className="mb-8">
          {t('planSubtitle', 'Unlock full access to EasyClaw')}
        </Text>

        {loading && packages.length === 0 ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginVertical: 32 }} />
        ) : packages.length > 0 ? (
          <View style={{ gap: 12 }}>
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.identifier}
                pkg={pkg}
                selected={selectedPackage?.identifier === pkg.identifier}
                onSelect={() => selectPackage(pkg)}
                t={t}
              />
            ))}
          </View>
        ) : (
          /* Fallback: show static plan card when offerings unavailable */
          <Card>
            <CardContent className="gap-3" style={{ paddingTop: 20 }}>
              <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                {t('planName')}
              </Text>
              <View className="flex-row items-baseline">
                <Text className="text-4xl font-black" style={{ letterSpacing: -1.5, color: colors.foreground }}>
                  {t('planPrice')}
                </Text>
                <Text style={{ fontSize: 16, marginLeft: 4, color: '#8B8B8B' }}>{t('planPeriod')}</Text>
              </View>
              <Separator />
              {FEATURES.map((key, i) => (
                <View key={i} className="flex-row items-start gap-3">
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text variant="muted" className="text-base flex-1">{t(key)}</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        )}

        {error && (
          <Text className="text-sm text-center mt-4" style={{ color: colors.destructive }}>{error}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          onPress={handleSubscribe}
          disabled={loading || (!selectedPackage && packages.length > 0)}
          className="w-full"
          style={{ backgroundColor: colors.primary }}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('continue')}</Text>
          )}
        </Button>

        <Button variant="ghost" onPress={handleRestore} disabled={loading}>
          <Text className="text-xs font-medium uppercase" style={{ letterSpacing: 2, color: colors.foreground }}>
            {t('restorePurchases')}
          </Text>
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
    color: colors.foreground,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B8B8B',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  card: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  packageType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B8B8B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  selectedBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
});
