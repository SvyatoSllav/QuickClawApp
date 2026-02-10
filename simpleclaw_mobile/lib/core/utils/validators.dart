final RegExp _telegramTokenRegex = RegExp(r'^\d{6,15}:[A-Za-z0-9_-]{30,50}$');

bool isValidTelegramToken(String token) {
  return _telegramTokenRegex.hasMatch(token);
}

String getTelegramTokenError(String token) {
  if (token.isEmpty) {
    return '';
  }
  if (!isValidTelegramToken(token)) {
    return 'Неверный формат токена. Токен должен быть в формате: '
        '123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
  }
  return '';
}
