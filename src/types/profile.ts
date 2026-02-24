export interface ProfileData {
  selectedModel: string;
  subscriptionStatus: string;
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  autoRenew: boolean;
  cancellationScheduled: boolean;
  cancelledAt: string | null;
  telegramBotUsername: string | null;
  telegramBotValidated: boolean;
  avatarUrl: string | null;
  tokensUsedUsd: number;
  tokenLimitUsd: number;
}

function parseDouble(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
}

export function profileFromJson(json: Record<string, unknown>): ProfileData {
  return {
    selectedModel: json['selected_model'] as string,
    subscriptionStatus: json['subscription_status'] as string,
    subscriptionStartedAt: (json['subscription_started_at'] as string) ?? null,
    subscriptionExpiresAt: (json['subscription_expires_at'] as string) ?? null,
    autoRenew: json['auto_renew'] as boolean,
    cancellationScheduled: json['cancellation_scheduled'] as boolean,
    cancelledAt: (json['cancelled_at'] as string) ?? null,
    telegramBotUsername: (json['telegram_bot_username'] as string) ?? null,
    telegramBotValidated: json['telegram_bot_validated'] as boolean,
    avatarUrl: (json['avatar_url'] as string) ?? null,
    tokensUsedUsd: parseDouble(json['tokens_used_usd']),
    tokenLimitUsd: Number(json['token_limit_usd']),
  };
}
