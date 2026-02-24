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
  Switch,
  Alert,
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
  const connectionState = useChatStore((s) => s.connectionState);

  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Fetch detail and initialize toggles when skill changes
  useEffect(() => {
    if (visible && skill) {
      if (__DEV__) console.log('[skills] Modal opened for skill:', skill.name, 'slug:', skill.slug, 'id:', skill.id);
      if (__DEV__) console.log('[skills] WS connectionState:', connectionState);

      const slug = skill.slug || skill.id || skill.name;
      setDetailLoading(true);
      setDetail(null);
      getSkillDetail(slug)
        .then((d) => {
          if (__DEV__) console.log('[skills] Detail fetched OK for', slug, 'keys:', d ? Object.keys(d) : 'null');
          setDetail(d);
        })
        .catch((e) => { if (__DEV__) console.log('[skills] detail fetch error:', e); })
        .finally(() => setDetailLoading(false));

      // Initialize toggles from current agent install state
      const initial: Record<string, boolean> = {};
      for (const agent of agents) {
        const installed = agent.skills?.includes(skill.name) ?? false;
        initial[agent.id] = installed;
        if (__DEV__) console.log('[skills] Agent', agent.id, 'skills:', JSON.stringify(agent.skills), '→ includes', skill.name, '=', installed);
      }
      if (__DEV__) console.log('[skills] Initial toggles:', JSON.stringify(initial));
      setToggles(initial);
    }
    if (visible) {
      setSubmitting(false);
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

  const toggleAgent = (agentId: string) => {
    setToggles((prev) => {
      const next = { ...prev, [agentId]: !prev[agentId] };
      if (__DEV__) console.log('[skills] Toggle agent', agentId, ':', prev[agentId], '→', next[agentId]);
      return next;
    });
  };

  const hasChanges = agents.some((a) => {
    const current = skill ? (a.skills?.includes(skill.name) ?? false) : false;
    return (toggles[a.id] ?? false) !== current;
  });

  const handleSubmit = async () => {
    if (__DEV__) console.log('[skills] handleSubmit called — skill:', skill?.name, 'hasChanges:', hasChanges, 'connectionState:', connectionState);
    if (!skill || !hasChanges) return;

    if (connectionState !== 'connected') {
      Alert.alert('Not connected', 'Cannot reach the server. Check your connection and try again.');
      return;
    }

    setSubmitting(true);

    // First get config to obtain baseHash and current agent skills
    const configResult: any = await new Promise((resolve) => {
      const reqId = sendRequest('config.get', {}, resolve);
      if (!reqId) resolve({ ok: false, error: 'WS disconnected' });
      else setTimeout(() => resolve({ ok: false, error: 'timeout' }), 15000);
    });

    if (!configResult.ok) {
      if (__DEV__) console.log('[skills] config.get failed:', configResult.error);
      setSubmitting(false);
      Alert.alert('Error', 'Failed to read config. Try again.');
      return;
    }

    const baseHash = configResult.result?.hash;
    const serverAgents: any[] = configResult.result?.config?.agents?.list ?? [];

    // Safety: refuse to patch if server returned no agents (would wipe config)
    if (serverAgents.length === 0) {
      if (__DEV__) console.log('[skills] config.get returned 0 agents — aborting to prevent data loss');
      setSubmitting(false);
      Alert.alert('Error', 'Server returned empty agent list. Try again.');
      return;
    }

    // Build updated agents.list preserving ALL fields, only changing skills
    const updatedList = serverAgents.map((cfgAgent: any) => {
      const currentSkills: string[] = cfgAgent.skills ?? [];
      const wantInstalled = toggles[cfgAgent.id] ?? false;
      const hasSkill = currentSkills.includes(skill.name);

      let nextSkills = currentSkills;
      if (wantInstalled && !hasSkill) {
        nextSkills = [...currentSkills, skill.name];
      } else if (!wantInstalled && hasSkill) {
        nextSkills = currentSkills.filter((s: string) => s !== skill.name);
      }

      // Spread full agent object to preserve model, workspace, tools, identity, etc.
      return { ...cfgAgent, skills: nextSkills };
    });

    const patch = { agents: { list: updatedList } };
    if (__DEV__) console.log('[skills] Sending config.patch baseHash:', baseHash, 'agents:', JSON.stringify(updatedList));

    const patchResult: any = await new Promise((resolve) => {
      const reqId = sendRequest('config.patch', { baseHash, raw: JSON.stringify(patch) }, resolve);
      if (!reqId) resolve({ ok: false, error: 'WS disconnected' });
      else setTimeout(() => resolve({ ok: false, error: 'timeout' }), 15000);
    });

    if (__DEV__) console.log('[skills] config.patch response:', JSON.stringify(patchResult).substring(0, 500));
    await fetchAgents();
    setSubmitting(false);

    if (!patchResult.ok) {
      if (__DEV__) console.log('[skills] config.patch FAILED:', patchResult.error);
      Alert.alert('Error', 'Failed to update skills. Try again.');
    } else {
      if (__DEV__) console.log('[skills] Submit success, closing modal');
      onClose();
    }
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
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onClose} />
      </Animated.View>

      {/* Modal — full screen */}
      <Animated.View style={[s.modal, modalStyle]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={8} disabled={submitting} style={s.backButton}>
            <ArrowLeft size={20} color={colors.foreground} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>
            {skill?.name ?? 'Skill'}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} disabled={submitting}>
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

            {/* Updated date */}
            {skill?.updatedAt && (
              <Text style={s.updatedAt}>
                Updated {new Date(skill.updatedAt).toLocaleDateString()}
              </Text>
            )}

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

          {/* Agents section — per-agent toggles */}
          {agents.length > 0 && (
            <View style={s.agentsSection}>
              <Text style={s.sectionTitle}>Agents</Text>
              {agents.map((agent) => (
                <View key={agent.id} style={s.agentRow}>
                  <Text style={s.agentEmoji}>{agentEmoji(agent)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.agentNameText}>{agentName(agent)}</Text>
                  </View>
                  <Switch
                    value={toggles[agent.id] ?? false}
                    onValueChange={() => toggleAgent(agent.id)}
                    disabled={submitting}
                    trackColor={{ false: '#D1D5DB', true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Submit button */}
        <View style={s.footer}>
          <Pressable
            style={[
              s.installButton,
              (!hasChanges || submitting) && s.installButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!hasChanges || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={s.installButtonText}>Submit</Text>
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
  strong: { color: colors.foreground, fontWeight: '700' },
  heading1: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginVertical: 8 },
  heading2: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginVertical: 6 },
  heading3: { color: colors.foreground, fontSize: 15, fontWeight: '600', marginVertical: 4 },
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
    marginBottom: 8,
  },
  updatedAt: {
    fontSize: 12,
    color: '#9CA3AF',
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
    backgroundColor: colors.accent,
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
    color: colors.mutedForeground,
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
