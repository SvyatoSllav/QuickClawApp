export interface TelegramValidation {
  valid: boolean;
  botUsername: string | null;
  botName: string | null;
}

export function telegramValidationFromJson(json: Record<string, unknown>): TelegramValidation {
  return {
    valid: json['valid'] as boolean,
    botUsername: (json['bot_username'] as string) ?? null,
    botName: (json['bot_name'] as string) ?? null,
  };
}
