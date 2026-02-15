export interface SubscriptionData {
  isActive: boolean;
  autoRenew: boolean;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  hasPaymentMethod: boolean;
  serverIp: string | null;
}

export function subscriptionFromJson(json: Record<string, unknown>): SubscriptionData {
  return {
    isActive: json['is_active'] as boolean,
    autoRenew: json['auto_renew'] as boolean,
    status: json['status'] as string,
    currentPeriodStart: (json['current_period_start'] as string) ?? null,
    currentPeriodEnd: (json['current_period_end'] as string) ?? null,
    cancelledAt: (json['cancelled_at'] as string) ?? null,
    hasPaymentMethod: json['has_payment_method'] as boolean,
    serverIp: (json['server_ip'] as string) ?? null,
  };
}
