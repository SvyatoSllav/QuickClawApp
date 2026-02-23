import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import { Menu, ChevronDown, FileText } from 'lucide-react-native';
import { useNavigationStore } from '../stores/navigationStore';
import { useChatStore } from '../stores/chatStore';
import { AVAILABLE_MODELS } from '../types/chat';
import { getModelIcon } from '../components/icons/ModelIcons';
import { colors } from '../config/colors';

interface FileItem {
  name: string;
  size: string;
  time: string;
}

const PLACEHOLDER_FILES: FileItem[] = [
  { name: 'AGENTS.md', size: '7.7 KB', time: '7m ago' },
  { name: 'SOUL.md', size: '1.6 KB', time: '7m ago' },
  { name: 'TOOLS.md', size: '860 B', time: '7m ago' },
  { name: 'IDENTITY.md', size: '636 B', time: '7m ago' },
  { name: 'USER.md', size: '477 B', time: '7m ago' },
  { name: 'HEARTBEAT.md', size: '168 B', time: '7m ago' },
  { name: 'BOOTSTRAP.md', size: '2.1 KB', time: '12m ago' },
];

export default function FilesScreen() {
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const [showDropdown, setShowDropdown] = useState(false);
  const [files] = useState<FileItem[]>(PLACEHOLDER_FILES);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  const CurrentModelIcon = currentModel ? getModelIcon(currentModel.icon) : null;

  return (
    <View style={localStyles.container}>
      {/* Header */}
      <View style={localStyles.header}>
        <Pressable onPress={toggleSidebar} hitSlop={8} style={{ padding: 4 }}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>
        <Text style={localStyles.headerTitle}>Files</Text>
        <View style={{ flex: 1 }} />
        {/* Model pill */}
        <Pressable
          onPress={() => setShowDropdown(!showDropdown)}
          style={localStyles.modelPill}
        >
          {CurrentModelIcon && <CurrentModelIcon size={14} />}
          <Text style={localStyles.modelPillText}>{currentModel?.label ?? 'Model'}</Text>
          <ChevronDown size={14} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 }}>
        <Text style={localStyles.pageTitle}>Files</Text>
        <Text style={localStyles.pageSubtitle}>Files on server</Text>

        <View style={{ gap: 10, marginTop: 12 }}>
          {files.map((file) => (
            <View key={file.name} style={localStyles.fileCard}>
              <View style={localStyles.fileIcon}>
                <FileText size={22} color="#F5A623" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={localStyles.fileName}>{file.name}</Text>
                <Text style={localStyles.fileMeta}>{file.size} {'\u00B7'} {file.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modelPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#8B8B8B',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: 'monospace',
  },
  fileMeta: {
    fontSize: 13,
    color: '#8B8B8B',
    marginTop: 2,
  },
});
