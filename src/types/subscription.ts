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
