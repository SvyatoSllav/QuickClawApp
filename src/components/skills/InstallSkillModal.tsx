import React, { useEffect, useState } from 'react';
import {
  View,
  Pressable,
  Dimensions,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import { Text } from '@/components/ui/text';
import { X, Star, Download, Tag, ArrowLeft } from 'lucide-react-native';
import { colors } from '../../config/colors';
import { useAgentStore } from '../../stores/agentStore';
import { useChatStore } from '../../stores/chatStore';
import { getSkillDetail, type SkillsmpSkill, type SkillDetail } from '../../api/skillsmpApi';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 280;
const EASING_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  skill: SkillsmpSkill | null;
  onClose: () => void;
}

function formatStars(n?: number): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function formatInstalls(n?: number): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export default function InstallSkillModal({ visible, skill, onClose }: Props) {
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const sendRequest = useChatStore((s) => s.sendRequest);

  const [installing, setInstalling] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Fetch detail when skill changes
  useEffect(() => {
    if (visible && skill) {
      const slug = skill.slug || skill.id || skill.name;
      setDetailLoading(true);
      setDetail(null);
      getSkillDetail(slug)
        .then((d) => setDetail(d))
        .catch((e) => console.log('[skills] detail fetch error:', e))
        .finally(() => setDetailLoading(false));
    }
    if (visible) {
      setInstalling(false);
    }
  }, [visible, skill]);

  // Animate
  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : SCREEN_HEIGHT, {
      duration: ANIM_DURATION,
      easing: EASING_CURVE,
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_DURATION,
      easing: EASING_CURVE,
    });
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const isInstalledOnAny = agents.some(
    (a) => skill && (a.skills?.includes(skill.name) ?? false),
  );

  const handleInstall = async () => {
    if (!skill) return;
    setInstalling(true);

    await new Promise<void>((resolve) => {
      sendRequest(
        'skills.install',
        { name: skill.name, timeoutMs: 30000 },
        (response: any) => {
          if (!response.ok) {
            console.log('[skills] install error:', response.error);
          }
          resolve();
        },
      );
      setTimeout(resolve, 35000);
    });

    await fetchAgents();
    setInstalling(false);
    onClose();
  };

  if (!visible && backdropOpacity.value === 0) return null;

  const agentName = (agent: any) =>
    agent.identity?.name || agent.name || agent.id;
  const agentEmoji = (agent: any) => agent.identity?.emoji || '\u{1F916}';

  const avatarUri = skill?.author
    ? `https://github.com/${skill.author}.png?size=40`
    : null;

  const displayDetail = detail || skill;
  const tags = displayDetail?.tags ?? [];
  const readme = detail?.readme || detail?.content || '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={installing ? undefined : onClose} />
      </Animated.View>

      {/* Modal — full screen */}
      <Animated.View style={[s.modal, modalStyle]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={8} disabled={installing} style={s.backButton}>
            <ArrowLeft size={20} color={colors.foreground} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>
            {skill?.name ?? 'Skill'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} disabled={installing}>
            <X size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView style={s.scrollContent} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* Skill info section */}
          <View style={s.infoSection}>
            {/* Author row */}
            {skill?.author && (
              <View style={s.authorRow}>
                {avatarUri && (
                  <Image source={{ uri: avatarUri }} style={s.authorAvatar} />
                )}
                <Text style={s.authorName}>{skill.author}</Text>
              </View>
            )}

            {/* Stats row */}
            <View style={s.statsRow}>
              {skill?.stars != null && (
                <View style={s.statItem}>
                  <Star size={14} color="#F59E0B" />
                  <Text style={s.statText}>{formatStars(skill.stars)}</Text>
                </View>
              )}
              {skill?.installs != null && (
                <View style={s.statItem}>
                  <Download size={14} color="#6B7280" />
                  <Text style={s.statText}>{formatInstalls(skill.installs)}</Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={s.description}>{displayDetail?.description}</Text>

            {/* Tags */}
            {tags.length > 0 && (
              <View style={s.tagsRow}>
                {tags.map((tag) => (
                  <View key={tag} style={s.tag}>
                    <Tag size={10} color={colors.primary} />
                    <Text style={s.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Links */}
            {(skill?.githubUrl || skill?.skillUrl || detail?.homepage) && (
              <View style={s.linksRow}>
                {detail?.homepage && (
                  <Pressable
                    onPress={() => Linking.openURL(detail.homepage!)}
                    style={s.linkButton}
                  >
                    <Text style={s.linkText}>Homepage</Text>
                  </Pressable>
                )}
                {skill?.githubUrl && (
                  <Pressable
                    onPress={() => Linking.openURL(skill.githubUrl!)}
                    style={s.linkButton}
                  >
                    <Text style={s.linkText}>GitHub</Text>
                  </Pressable>
                )}
                {skill?.skillUrl && (
                  <Pressable
                    onPress={() => Linking.openURL(skill.skillUrl!)}
                    style={s.linkButton}
                  >
                    <Text style={s.linkText}>SkillsMP</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Metadata from SKILL.md */}
            {detail?.metadata?.emoji && (
              <Text style={s.metadataEmoji}>{detail.metadata.emoji}</Text>
            )}
          </View>

          {/* README / Detail content */}
          {detailLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : readme ? (
            <View style={s.readmeSection}>
              <Text style={s.sectionTitle}>About</Text>
              <Markdown style={mdStyles}>{readme}</Markdown>
            </View>
          ) : null}

          {/* Agents section — read-only */}
          {agents.length > 0 && (
            <View style={s.agentsSection}>
              <Text style={s.sectionTitle}>Agents</Text>
              {agents.map((agent) => {
                const installed = skill ? (agent.skills?.includes(skill.name) ?? false) : false;
                return (
                  <View key={agent.id} style={s.agentRow}>
                    <Text style={s.agentEmoji}>{agentEmoji(agent)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.agentNameText}>{agentName(agent)}</Text>
                    </View>
                    {installed && (
                      <Text style={s.installedBadge}>Installed</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Install button */}
        <View style={s.footer}>
          <Pressable
            style={[
              s.installButton,
              (isInstalledOnAny || installing) && s.installButtonDisabled,
            ]}
            onPress={handleInstall}
            disabled={isInstalledOnAny || installing}
          >
            {installing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={s.installButtonText}>
                {isInstalledOnAny ? 'Already installed' : 'Install skill'}
              </Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const mdStyles = StyleSheet.create({
  body: { color: '#374151', fontSize: 14, lineHeight: 22 } as any,
  paragraph: { marginTop: 0, marginBottom: 8 },
  strong: { color: '#1A1A1A', fontWeight: '700' },
  heading1: { color: '#1A1A1A', fontSize: 18, fontWeight: '700', marginVertical: 8 },
  heading2: { color: '#1A1A1A', fontSize: 16, fontWeight: '700', marginVertical: 6 },
  heading3: { color: '#1A1A1A', fontSize: 15, fontWeight: '600', marginVertical: 4 },
  code_inline: {
    backgroundColor: '#F3F4F6',
    color: '#DC2626',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fence: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bullet_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  link: { color: '#2563EB' },
});

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  scrollContent: {
    flex: 1,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  linkButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  readmeSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B8B8B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  agentsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  agentEmoji: {
    fontSize: 24,
  },
  agentNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  installedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  metadataEmoji: {
    fontSize: 28,
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  installButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installButtonDisabled: {
    opacity: 0.5,
  },
  installButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
