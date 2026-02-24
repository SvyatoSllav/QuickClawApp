import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Menu } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';
import { OPENCLAW_PROMPTS, OpenClawPrompt } from '../data/openclawPrompts';
import PromptCard from '../components/knowledgebase/PromptCard';
import PromptDetailModal from '../components/knowledgebase/PromptDetailModal';

export default function KnowledgeBaseScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const [selectedPrompt, setSelectedPrompt] = useState<OpenClawPrompt | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleCardPress = (prompt: OpenClawPrompt) => {
    setSelectedPrompt(prompt);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Knowledge Base</Text>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent}>
        <Text style={s.sectionLabel}>OPENCLAW PROMPTS</Text>
        <Text style={s.subtitle}>Ready-to-use prompts for common workflows</Text>

        <View style={s.cardList}>
          {OPENCLAW_PROMPTS.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} onPress={handleCardPress} />
          ))}
        </View>
      </ScrollView>

      <PromptDetailModal
        visible={modalVisible}
        prompt={selectedPrompt}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const s = StyleSheet.create({
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
    gap: 12,
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: colors.foreground,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  cardList: {
    gap: 12,
  },
});
