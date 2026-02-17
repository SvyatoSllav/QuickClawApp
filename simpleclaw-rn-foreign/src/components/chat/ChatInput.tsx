import React, { useState, useRef } from 'react';
import { View, Image, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '../../stores/chatStore';
import { colors } from '../../config/colors';
import AttachIcon from '../icons/AttachIcon';
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
    <View className="border-t border-border">
      {attachments.length > 0 && (
        <View className="flex-row gap-2 px-4 pt-3">
          {attachments.map((att, i) => (
            <View key={i} className="relative">
              <Image
                source={{ uri: att.uri }}
                style={{ width: 56, height: 56, borderRadius: 8 }}
              />
              <Pressable
                onPress={() => removeAttachment(i)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive items-center justify-center"
              >
                <Text className="text-[10px] text-destructive-foreground font-bold">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row items-center px-4 py-3 gap-2">
        <Pressable
          onPress={handlePickImage}
          disabled={connectionState !== 'connected'}
          className="p-2"
          style={{ opacity: connectionState !== 'connected' ? 0.4 : 1 }}
        >
          <AttachIcon size={22} color={colors.mutedForeground} />
        </Pressable>

        <Input
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('typeMessage')}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={4000}
          className={`flex-1 h-auto min-h-12 max-h-40 py-3 px-4 ${
            isMultiline ? 'rounded-2xl' : 'rounded-full'
          }`}
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

        <Button
          size="icon"
          variant={canSend ? 'default' : 'secondary'}
          onPress={canSend ? sendMessage : undefined}
          disabled={!canSend}
          className="rounded-full"
        >
          <Text className="text-lg">↑</Text>
        </Button>
      </View>
    </View>
  );
}
