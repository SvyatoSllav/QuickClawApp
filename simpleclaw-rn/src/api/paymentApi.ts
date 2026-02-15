import apiClient from './client';
import { PaymentResponse, paymentFromJson, TokenPaymentResponse, tokenPaymentFromJson } from '../types/payment';

export async function createPayment(params: {
  telegramToken?: string | null;
  selectedModel: string;
}): Promise<PaymentResponse> {
  const response = await apiClient.post('/payments/create/', {
    telegram_token: params.telegramToken,
    selected_model: params.selectedModel,
  });
  return paymentFromJson(response.data);
}

export async function createPaymentWithToken(params: {
  paymentToken: string;
  telegramToken?: string | null;
  selectedModel: string;
}): Promise<TokenPaymentResponse> {
  const response = await apiClient.post('/payments/create-with-token/', {
    payment_token: params.paymentToken,
    telegram_token: params.telegramToken,
    selected_model: params.selectedModel,
  });
  return tokenPaymentFromJson(response.data);
}
