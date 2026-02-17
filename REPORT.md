# SimpleClaw React Native - Отчёт по анализу и тестированию

## 1. Что было сделано

### Изменение порядка моделей
- **Gemini** (gemini-3-flash) - теперь **первый и выбран по умолчанию**
- **Claude** (Sonnet 4) - второй вариант, отображается как "Claude (Sonnet 4)"
- **GPT** (gpt-4o) - третий вариант

### Исправленные файлы
| Файл | Что изменено |
|------|-------------|
| `src/screens/landing/ModelSelector.tsx` | Порядок моделей, ID соответствуют backend MODEL_MAPPING |
| `src/stores/selectionStore.ts` | Default: `gemini-3-flash` |
| `src/stores/authStore.ts` | Fallback модель + `createPayment` берёт модель из selectionStore |
| `src/screens/ProfileScreen.tsx` | Fallback отображения модели |

### Ключевое исправление
Раньше frontend отправлял на backend generic ID (`claude`, `gpt`, `gemini`), которые **не совпадали** с `MODEL_MAPPING` в `production.py`. Теперь ID точно соответствуют:
- `gemini-3-flash` -> `google/gemini-3-flash-preview`
- `claude-sonnet-4` -> `anthropic/claude-sonnet-4`
- `gpt-4o` -> `openai/gpt-4o`

---

## 2. Что может пойти не так (потенциальные проблемы)

### КРИТИЧЕСКИЕ

**2.1. iOS: отсутствие платёжного флоу**
- **Файл:** `authStore.ts:128-132`
- **Проблема:** На iOS после авторизации пользователь просто остаётся на landing-экране без объяснения, что делать дальше (подписка через веб)
- **Последствие:** Пользователь думает, что приложение сломано
- **Рекомендация:** Добавить сообщение "Для подписки перейдите на install-openclow.ru"

**2.2. Telegram-токен может быть невалидным при создании платежа**
- **Файл:** `authStore.ts:179`
- **Проблема:** `createPayment()` берёт pending токен из storage без проверки валидности. Если `telegramStore.savePendingToken()` сохранил токен, но валидация на сервере не прошла, платёж создастся с битым токеном
- **Последствие:** Пользователь заплатит, но бот не заработает
- **Рекомендация:** Проверять `telegramStore.validationError` перед созданием платежа

**2.3. Деплой: ошибка не показывается пользователю**
- **Файл:** `deployStore.ts:40-57`
- **Проблема:** При `status === 'error'` polling останавливается, но нет чёткого error-сообщения в UI на SuccessScreen
- **Последствие:** Пользователь видит застывший спиннер
- **Рекомендация:** Показывать явное сообщение об ошибке с кнопкой "Написать в поддержку"

### СРЕДНИЕ

**2.4. ProfileScreen использует `Alert.alert()` для отмены подписки**
- **Файл:** `ProfileScreen.tsx:40-63`
- **Проблема:** `Alert.alert()` не работает на web. На production web-версии кнопка "Отменить подписку" ничего не сделает
- **Последствие:** Невозможно отменить подписку через веб-версию
- **Рекомендация:** Использовать custom modal вместо `Alert.alert()` или проверять `Platform.OS`

**2.5. Google Sign-In: разные флоу для web и native**
- **Файл:** `googleAuth.ts:54-100`
- **Проблема:** Web использует OAuth token + fetch userInfo, Native использует ID token напрямую. Два разных пути аутентификации
- **Последствие:** Edge cases при расхождении ответов Google API
- **Рекомендация:** Допустимо, но нужно тестировать оба пути отдельно

**2.6. Нет retry-логики при сетевых ошибках**
- **Файл:** Все API-вызовы в `authStore.ts`
- **Проблема:** Если запрос упал — сразу ошибка, нет повторных попыток
- **Последствие:** На нестабильном мобильном интернете часто будут ошибки
- **Рекомендация:** Добавить exponential backoff хотя бы для `loadProfile()` и `createPayment()`

**2.7. MarqueeSection: нестабильное измерение ширины**
- **Файл:** `MarqueeSection.tsx:49-50`
- **Проблема:** Web-версия измеряет `scrollWidth` через 100ms timeout. На медленных устройствах DOM может быть не готов
- **Последствие:** Marquee может не анимироваться или прыгать
- **Рекомендация:** Использовать `ResizeObserver` или увеличить timeout

**2.8. Подписка reactivate не используется**
- **Файл:** `subscriptionApi.ts` имеет `reactivateSubscription()`, но нигде не вызывается
- **Последствие:** Если пользователь отменил подписку, он не может её восстановить через приложение

### МЕЛКИЕ

**2.9. Нет deep linking для платёжных URL**
- `app.json` задаёт scheme `simpleclaw`, но обработка deep links не реализована
- Payment confirmation URL может не вернуть пользователя обратно в приложение

**2.10. Usage limit по умолчанию 15**
- `usageStore.ts:15` — захардкожен лимит 15$, который может не совпадать с backend

**2.11. Нет кнопки "Войти через Apple" на Android/Web**
- Это правильное поведение (Apple Sign-In только на iOS), но нет визуального объяснения

---

## 3. Тестирование дизайна

### Проверено:
- Desktop (1280x900): Все элементы отображаются корректно
- Mobile (390x844): Респонсивная верстка работает, maxWidth: 900 ограничивает ширину
- Выбор модели: Переключение работает, галочка перемещается
- Порядок: Gemini первый и выбран, Claude второй, GPT третий
- Иконки моделей загружаются с Wikipedia/CDN
- Comparison section: Таблица читаемая
- Marquee: Анимация работает на web
- Footer: Все ссылки на месте

### Замечания по дизайну:
- Отсутствует кнопка "Назад" на landing (нет навигации "назад")
- Нет индикации загрузки при первом открытии (пока `useInitAuth` проверяет токен)
- Telegram-модалка открывается как BottomSheet — на web может выглядеть неоптимально

---

## 4. Как тестировать на TestFlight (iOS)

### Предварительные требования:
- Mac с macOS
- Xcode (последняя версия)
- Аккаунт Apple Developer ($99/год): https://developer.apple.com
- EAS CLI (`npm install -g eas-cli`)

### Шаги:

**4.1. Настройка проекта**
```bash
cd simpleclaw-rn
npx eas login          # войти в Expo аккаунт
npx eas build:configure
```

**4.2. Настройка app.json**
Убедиться что `ios.bundleIdentifier` = `com.simpleclaw.app` и в Apple Developer Console создан этот App ID.

**4.3. Сборка для TestFlight**
```bash
npx eas build --platform ios --profile preview
```
Это создаст `.ipa` файл в облаке Expo. Профиль `preview` нужно добавить в `eas.json`:
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

**4.4. Загрузка в TestFlight**
1. Скачать `.ipa` из Expo dashboard
2. Открыть **Transporter** (бесплатное приложение от Apple) на Mac
3. Загрузить `.ipa` через Transporter -> App Store Connect
4. Подождать обработку (~5-30 минут)
5. В App Store Connect -> TestFlight -> добавить тестировщиков
6. Тестировщики получат приглашение и смогут установить через TestFlight

**4.5. Альтернатива: Ad Hoc через EAS**
```bash
npx eas build --platform ios --profile preview
```
С `"distribution": "internal"` — Expo создаст ссылку для прямой установки на зарегистрированные устройства (без TestFlight).

### Важно для TestFlight:
- Нужен **Apple Developer Program** ($99/год)
- Первая сборка может занять 30-60 минут
- Apple проверяет даже TestFlight-сборки (1-2 дня на первую проверку)
- Google Sign-In требует настройки `GoogleService-Info.plist`
- Apple Sign-In требует включённого Capability в Xcode

---

## 5. Как тестировать на Replit (Web)

### Вариант A: Expo Web на Replit

**5.1. Создать Replit-проект**
1. Зайти на https://replit.com
2. Создать новый Repl -> Import from GitHub (или загрузить папку `simpleclaw-rn`)
3. Выбрать шаблон **Node.js**

**5.2. Настроить окружение**
В shell Replit:
```bash
npm install
```

**5.3. Настроить .replit**
Создать файл `.replit`:
```toml
run = "npx expo start --web --port 3000"

[nix]
channel = "stable-24_05"

[[ports]]
localPort = 3000
externalPort = 80
```

**5.4. Запуск**
Нажать кнопку Run. Expo соберёт web-бандл и откроет preview в браузере Replit.

**5.5. Переменные окружения**
В Replit Secrets добавить:
- `EXPO_PUBLIC_API_BASE_URL` = `https://install-openclow.ru/api`

### Вариант B: Expo Snack (быстрее)

1. Зайти на https://snack.expo.dev
2. Загрузить файлы проекта
3. Выбрать платформу (Web / Android / iOS)
4. Тестировать прямо в браузере

**Ограничения Snack:** Не все нативные модули работают (например, `expo-secure-store`, `@gorhom/bottom-sheet`). Для полного тестирования лучше Replit или локальная сборка.

### Вариант C: Replit + Android (через Expo Go)

1. Запустить `npx expo start` на Replit
2. Скопировать QR-код или URL
3. Открыть **Expo Go** на телефоне
4. Отсканировать QR-код
5. Приложение запустится на телефоне через Expo Go

**Ограничения Expo Go:** Не поддерживает кастомные нативные модули. Для `@react-native-google-signin` нужна dev-сборка (`npx expo run:android`).

---

## 6. Рекомендуемый порядок тестирования

1. **Web (Replit/localhost)** — проверить UI, навигацию, выбор модели, марки
2. **Android (Expo Go)** — проверить нативные анимации, BottomSheet
3. **Android (EAS Build)** — полный тест с Google Sign-In, оплатой
4. **iOS (TestFlight)** — полный тест с Apple Sign-In, reader app flow

### Чек-лист тестирования:
- [ ] Gemini выбран по умолчанию при первом открытии
- [ ] Переключение между моделями работает
- [ ] Telegram модалка открывается при нажатии на Telegram
- [ ] Валидация токена бота (неверный формат -> красная рамка)
- [ ] Google Sign-In работает (web + native)
- [ ] Apple Sign-In работает (только iOS)
- [ ] После авторизации: проверка подписки
- [ ] Создание платежа отправляет правильный `selected_model`
- [ ] Success screen: polling статуса деплоя
- [ ] Profile screen: отображение подписки и usage
- [ ] Отмена подписки (только native, не web!)
- [ ] Marquee анимация плавная
- [ ] Footer ссылки работают
