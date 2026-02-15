const TELEGRAM_TOKEN_REGEX = /^\d{6,15}:[A-Za-z0-9_-]{30,50}$/;

export function isValidTelegramToken(token: string): boolean {
  return TELEGRAM_TOKEN_REGEX.test(token);
}

export function getTelegramTokenError(token: string): string {
  if (!token) return '';
  if (!isValidTelegramToken(token)) {
    return 'Неверный формат токена. Токен должен быть в формате: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
  }
  return '';
}
