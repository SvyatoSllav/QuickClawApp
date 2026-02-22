import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Pressable,
  Dimensions,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { X } from 'lucide-react-native';
import { colors } from '../../config/colors';
import { useAgentStore } from '../../stores/agentStore';
import { useChatStore } from '../../stores/chatStore';
import type { SkillsmpSkill } from '../../api/skillsmpApi';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.55;
const ANIM_DURATION = 280;
const EASING_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  skill: SkillsmpSkill | null;
  onClose: () => void;
}

export default function InstallSkillModal({ visible, skill, onClose }: Props) {
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const sendRequest = useChatStore((s) => s.sendRequest);

  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [installing, setInstalling] = useState(false);

  const translateY = useSharedValue(MODAL_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Reset toggles when skill or visibility changes
  useEffect(() => {
    if (visible && skill) {
      const initial: Record<string, boolean> = {};
      for (const agent of agents) {
        const alreadyInstalled = agent.skills?.includes(skill.name) ?? false;
        if (alreadyInstalled) {
          initial[agent.id] = true;
        } else if (agent.id === activeAgentId) {
          initial[agent.id] = true;
        } else {
          initial[agent.id] = false;
        }
      }
      setToggles(initial);
      setInstalling(false);
    }
  }, [visible, skill, agents, activeAgentId]);

  // Animate
  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : MODAL_HEIGHT, {
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

  const isAlreadyInstalled = useCallback(
    (agentId: string) => {
      if (!skill) return false;
      const agent = agents.find((a) => a.id === agentId);
      return agent?.skills?.includes(skill.name) ?? false;
    },
    [agents, skill],
  );

  const toggleAgent = (agentId: string) => {
    if (isAlreadyInstalled(agentId)) return;
    setToggles((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const selectedCount = Object.entries(toggles).filter(
    ([id, on]) => on && !isAlreadyInstalled(id),
  ).length;

  const handleInstall = async () => {
    if (!skill || selectedCount === 0) return;
    setInstalling(true);

    const toInstall = Object.entries(toggles)
      .filter(([id, on]) => on && !isAlreadyInstalled(id))
      .map(([id]) => id);

    let completed = 0;
    let hasError = false;

    for (const agentId of toInstall) {
      await new Promise<void>((resolve) => {
        sendRequest(
          'skills.install',
          { name: skill.name, installId: agentId, timeoutMs: 30000 },
          (response: any) => {
            completed++;
            if (!response.ok) {
              hasError = true;
              console.log('[skills] install error:', response.error);
            }
            resolve();
          },
        );
        // Fallback timeout in case callback never fires
        setTimeout(resolve, 35000);
      });
    }

    await fetchAgents();
    setInstalling(false);
    onClose();
  };

  if (!visible && backdropOpacity.value === 0) return null;

  const agentName = (agent: any) =>
    agent.identity?.name || agent.name || agent.id;
  const agentEmoji = (agent: any) => agent.identity?.emoji || '🤖';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={installing ? undefined : onClose} />
      </Animated.View>

      {/* Modal */}
      <Animated.View style={[s.modal, modalStyle]}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Install Skill</Text>
            {skill && <Text style={s.headerSkillName}>{skill.name}</Text>}
          </View>
          <Pressable onPress={onClose} hitSlop={8} disabled={installing}>
            <X size={20} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Agent list */}
        <ScrollView style={s.agentList} contentContainerStyle={{ paddingBottom: 16 }}>
          {agents.map((agent) => {
            const installed = isAlreadyInstalled(agent.id);
            return (
              <Pressable
                key={agent.id}
                style={s.agentRow}
                onPress={() => toggleAgent(agent.id)}
                disabled={installed || installing}
              >
                <Text style={s.agentEmoji}>{agentEmoji(agent)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.agentNameText}>{agentName(agent)}</Text>
                  {installed && (
                    <Text style={s.installedLabel}>Already installed</Text>
                  )}
                </View>
                <Switch
                  value={toggles[agent.id] ?? false}
                  onValueChange={() => toggleAgent(agent.id)}
                  disabled={installed || installing}
                  trackColor={{ false: '#E5E7EB', true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Install button */}
        <View style={s.footer}>
          <Pressable
            style={[
              s.installButton,
              (selectedCount === 0 || installing) && s.installButtonDisabled,
            ]}
            onPress={handleInstall}
            disabled={selectedCount === 0 || installing}
          >
            {installing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={s.installButtonText}>
                Install on {selectedCount} agent{selectedCount !== 1 ? 's' : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  headerSkillName: {
    fontSize: 13,
    color: colors.mutedForeground,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  agentList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  installedLabel: {
    fontSize: 12,
    color: colors.destructive,
    marginTop: 2,
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
