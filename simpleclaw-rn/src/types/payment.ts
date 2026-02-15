export interface PaymentResponse {
  paymentId: number;
  confirmationUrl: string;
  yookassaId: string;
}

export function paymentFromJson(json: Record<string, unknown>): PaymentResponse {
  return {
    paymentId: json['payment_id'] as number,
    confirmationUrl: json['confirmation_url'] as string,
    yookassaId: json['yookassa_id'] as string,
  };
}

export interface TokenPaymentResponse {
  paymentId: number;
  yookassaId: string;
  status: string;
}

export function tokenPaymentFromJson(json: Record<string, unknown>): TokenPaymentResponse {
  return {
    paymentId: json['payment_id'] as number,
    yookassaId: json['yookassa_id'] as string,
    status: json['status'] as string,
  };
}
