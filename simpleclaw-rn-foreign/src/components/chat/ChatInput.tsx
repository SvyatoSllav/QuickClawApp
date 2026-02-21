import React, { useState, useRef } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { useChatStore } from '../../stores/chatStore';
import { colors } from '../../config/colors';
import { Paperclip, Mic, Send } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ChatInput() {
  const { t } = useTranslation();
  const inputText = useChatStore((s) => s.inputText);
  const setInputText = useChatStore((s) => s.setInputText);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const connectionState = useChatStore((s) => s.connectionState);
  const attachments = useChatStore((s) => s.attachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);
  const [inputHeight, setInputHeight] = useState(48);
  const lastHeight = useRef(48);

  const canSend =
    (inputText.trim().length > 0 || attachments.length > 0) &&
    connectionState === 'connected';

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      for (const asset of result.assets) {
        if (asset.base64) {
          addAttachment({
            uri: asset.uri,
            base64: asset.base64,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? `image-${Date.now()}.jpg`,
          });
        }
      }
    }
  };

  const isMultiline = inputHeight > 52;

  return (
    <View style={styles.outerContainer}>
      {attachments.length > 0 && (
        <View style={styles.attachmentsRow}>
          {attachments.map((att, i) => (
            <View key={i} style={styles.attachmentThumb}>
              <Image
                source={{ uri: att.uri }}
                style={{ width: 56, height: 56, borderRadius: 8 }}
              />
              <Pressable
                onPress={() => removeAttachment(i)}
                style={styles.removeAttachment}
              >
                <Text style={styles.removeText}>{'\u2715'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.inputContainer}>
        <Pressable
          onPress={handlePickImage}
          disabled={connectionState !== 'connected'}
          style={{ padding: 8, opacity: connectionState !== 'connected' ? 0.4 : 1 }}
        >
          <Paperclip size={20} color={colors.mutedForeground} />
        </Pressable>

        <Input
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('typeMessage')}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={4000}
          className={`flex-1 h-auto min-h-12 max-h-40 py-3 px-4 bg-transparent border-0 ${
            isMultiline ? 'rounded-2xl' : 'rounded-full'
          }`}
          style={{ color: colors.foreground }}
          editable={connectionState === 'connected'}
          onSubmitEditing={canSend ? sendMessage : undefined}
          onContentSizeChange={(e: any) => {
            const h = e?.nativeEvent?.contentSize?.height;
            if (h) {
              const clamped = Math.min(160, Math.max(48, h));
              if (Math.abs(clamped - lastHeight.current) > 2) {
                lastHeight.current = clamped;
                setInputHeight(clamped);
              }
            }
          }}
        />

        <Pressable style={{ padding: 8 }}>
          <Mic size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={canSend ? sendMessage : undefined}
          disabled={!canSend}
          style={[
            styles.sendButton,
            { opacity: canSend ? 1 : 0.4 },
          ]}
        >
          <Send size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  attachmentsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  attachmentThumb: {
    position: 'relative',
  },
  removeAttachment: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 2,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
});
