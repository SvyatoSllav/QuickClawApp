# Гайд: Разработка и тестирование React Native приложений (Xcode + Expo + Claude)

## Контекст

Этот гайд создан для проекта SimpleClaw (EasyClaw) — React Native приложение на базе Expo SDK 54, React Native 0.81.5, TypeScript. Гайд охватывает полный цикл: от установки инструментов до сборки, тестирования и отладки на iOS через Xcode, с использованием Claude Code как AI-ассистента.

---

## Часть 1: Установка и настройка окружения

### 1.1 Системные требования

- **macOS** 14 (Sonoma) или новее (обязательно для iOS-разработки)
- **16 GB RAM** минимум (рекомендуется 32 GB для комфортной работы с Xcode)
- **50+ GB свободного места** на диске (Xcode ~15 GB + симуляторы ~10 GB + кэши)

### 1.2 Установка Xcode

1. Откройте **App Store** → найдите **Xcode** → установите (версия 16.1+ обязательна для Expo SDK 54)
2. После установки запустите Xcode один раз — он предложит установить дополнительные компоненты. Согласитесь
3. Установите Command Line Tools:
   ```bash
   xcode-select --install
   ```
4. Примите лицензию:
   ```bash
   sudo xcodebuild -license accept
   ```
5. Проверьте установку:
   ```bash
   xcode-select -p
   # Должно показать: /Applications/Xcode.app/Contents/Developer
   ```

#### Установка iOS-симуляторов

1. Xcode → Settings → Platforms
2. Скачайте нужные версии iOS (рекомендуется последняя + предпоследняя)
3. Проверка:
   ```bash
   xcrun simctl list devices
   ```

### 1.3 Установка Node.js и npm

```bash
# Через Homebrew (рекомендуется)
brew install node

# Или через nvm для управления версиями
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20

# Проверка
node -v   # >= 18.0.0
npm -v    # >= 9.0.0
```

### 1.4 Установка Watchman

```bash
brew install watchman
```

Watchman — файловый наблюдатель от Meta, значительно ускоряет работу Metro bundler.

### 1.5 Установка CocoaPods

```bash
sudo gem install cocoapods
# Или через Homebrew:
brew install cocoapods

# Проверка
pod --version
```

> **Примечание:** В Expo SDK 54 CocoaPods управляется автоматически через `npx expo run:ios`. Прямой вызов `pod install` обычно не нужен.

### 1.6 Установка Expo CLI и EAS CLI

```bash
# Expo CLI (встроен в npx, отдельная установка не обязательна)
# Но для удобства:
npm install -g expo-cli

# EAS CLI — для облачных сборок и деплоя
npm install -g eas-cli

# Проверка
npx expo --version
eas --version
```

### 1.7 Аккаунт Expo (EAS)

```bash
# Создание аккаунта (если нет)
eas login
# Или зарегистрируйтесь на https://expo.dev/signup
```

### 1.8 Apple Developer Account

- **Бесплатный аккаунт** — позволяет тестировать на своём устройстве (ограничения: 10 App ID, сертификаты на 7 дней)
- **Платный ($99/год)** — нужен для TestFlight, App Store, полноценной команды разработки

Для минимального тестирования на симуляторе Apple Developer аккаунт **не требуется**.

### 1.9 Установка Claude Code

```bash
# Установка через npm
npm install -g @anthropic-ai/claude-code

# Запуск
claude

# Проверка версии
claude --version
```

Для работы нужен API-ключ Anthropic — задайте его при первом запуске или через переменную окружения `ANTHROPIC_API_KEY`.

---

## Часть 2: Инициализация и настройка проекта

### 2.1 Клонирование / создание проекта

```bash
# Для существующего проекта
git clone <repo-url>
cd simpleclaw-rn-foreign

# Установка зависимостей
npm install
```

### 2.2 Структура Expo-проекта (SimpleClaw)

```
simpleclaw-rn-foreign/
├── app/                    # Expo Router — файловая маршрутизация
│   ├── _layout.tsx         # Корневой layout (шрифты, жесты, навигация)
│   └── index.tsx           # Главная точка входа
├── src/
│   ├── api/                # Axios-клиенты с интерцепторами
│   ├── components/         # UI-компоненты (chat/, ui/, icons/)
│   ├── config/             # Конфигурация (API URL, цвета)
│   ├── screens/            # Экраны приложения
│   ├── stores/             # Zustand-хранилища (10 сторов)
│   ├── services/           # Бизнес-логика (auth, storage)
│   ├── hooks/              # React-хуки
│   ├── i18n/               # Интернационализация (i18next)
│   └── types/              # TypeScript-типы
├── android/                # Нативный Android-код
├── ios/                    # Нативный iOS-код (генерируется при prebuild)
├── assets/                 # Иконки, шрифты, сплэш-скрин
├── app.json                # Конфигурация Expo
├── eas.json                # Конфигурация EAS Build
├── babel.config.js         # Babel
├── metro.config.js         # Metro bundler
├── tailwind.config.js      # NativeWind/Tailwind
└── tsconfig.json           # TypeScript
```

### 2.3 Конфигурация app.json (ключевые поля)

```jsonc
{
  "expo": {
    "name": "EasyClaw",
    "slug": "simpleclaw-rn",
    "scheme": "simpleclaw",
    "newArchEnabled": true,          // New Architecture (TurboModules, Fabric)
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.simpleclaw.app",
      "googleServicesFile": "./GoogleService-Info.plist",
      "usesAppleSignIn": true
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-apple-authentication",
      "@react-native-google-signin/google-signin"
      // ...
    ]
  }
}
```

### 2.4 Конфигурация eas.json (профили сборки)

```jsonc
{
  "build": {
    "development": {
      // Для разработки — включает dev-client, быстрая пересборка
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      // Для тестирования — production API, но internal distribution
      "distribution": "internal",
      "env": { "EXPO_PUBLIC_API_URL": "https://..." }
    },
    "production": {
      // Для App Store / Play Store
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

---

## Часть 3: Запуск и разработка

### 3.1 Запуск на iOS-симуляторе (быстрый старт)

```bash
cd simpleclaw-rn-foreign

# Способ 1: Expo Go (простой, но не поддерживает кастомные нативные модули)
npx expo start
# Нажмите "i" для запуска на iOS-симуляторе

# Способ 2: Development Build (полная поддержка нативных модулей)
npx expo run:ios
# Это выполнит: prebuild → pod install → xcodebuild → запуск на симуляторе
```

> **Важно:** Проект SimpleClaw использует кастомные нативные модули (Google Sign-In, Apple Auth, RevenueCat), поэтому **Expo Go не подходит**. Нужен development build.

### 3.2 Команда `npx expo run:ios` — что происходит под капотом

1. **Prebuild** — генерирует `ios/` директорию из `app.json` + плагинов
2. **Pod Install** — устанавливает нативные зависимости через CocoaPods
3. **Xcode Build** — компилирует нативный проект через `xcodebuild`
4. **Install** — устанавливает приложение на симулятор/устройство
5. **Metro** — запускает JS-бандлер для live-перезагрузки

### 3.3 Запуск на физическом iOS-устройстве

#### Через Xcode (рекомендуется для отладки):

1. Сгенерируйте нативный проект:
   ```bash
   npx expo prebuild --platform ios
   ```
2. Откройте проект в Xcode:
   ```bash
   open ios/simpleclawrn.xcworkspace
   ```
   > **Важно:** Открывайте `.xcworkspace`, не `.xcodeproj`!

3. В Xcode:
   - Signing & Capabilities → выберите свою Team (Apple ID)
   - Измените Bundle Identifier, если конфликтует (добавьте `.dev` суффикс)
   - Подключите устройство по кабелю или Wi-Fi
   - На устройстве: Settings → Privacy & Security → Developer Mode → включите
   - Выберите устройство в верхней панели Xcode → нажмите Run (▶)

4. Запустите Metro отдельно (в другом терминале):
   ```bash
   npx expo start
   ```

#### Через EAS Build (для удалённой сборки):

```bash
# Создать development build для физического устройства
eas build --profile development --platform ios

# После сборки — скачайте и установите через QR-код или Expo Orbit
```

### 3.4 Горячая перезагрузка и Fast Refresh

После первоначальной нативной сборки все JS-изменения подхватываются **мгновенно** через Metro:

- **Fast Refresh** — автоматически при сохранении файла
- **Full Reload** — `Cmd+R` в симуляторе или встряхните устройство → Reload
- **Dev Menu** — `Cmd+D` в симуляторе или встряхните устройство

Нативная пересборка нужна **только при**:
- Добавлении новой нативной зависимости
- Изменении `app.json` / плагинов
- Модификации нативного кода в `ios/` или `android/`

---

## Часть 4: Сборка через EAS Build

### 4.1 Облачная сборка (рекомендуется)

```bash
# Development build (с dev-client, для разработки)
eas build --profile development --platform ios

# Preview build (production API, для тестирования)
eas build --profile preview --platform ios

# Production build (для App Store)
eas build --profile production --platform ios
```

EAS автоматически управляет сертификатами и provisioning profiles.

### 4.2 Локальная сборка (для отладки проблем сборки)

```bash
# Требует полностью настроенный Xcode
eas build --profile development --platform ios --local
```

Используйте локальную сборку, когда:
- Облачная сборка падает и нужна диагностика
- Нужен полный контроль над процессом
- Политика компании запрещает облачные CI/CD

### 4.3 Установка на симулятор после EAS Build

```bash
# В eas.json добавьте для симулятора:
# "ios": { "simulator": true }

# После сборки — установите через Expo Orbit
# Или вручную:
xcrun simctl install booted path/to/app.app
```

---

## Часть 5: Отладка и тестирование

### 5.1 Инструменты отладки

| Инструмент | Что отлаживает | Как открыть |
|---|---|---|
| React Native DevTools | JavaScript, компоненты, профилирование | `j` в Metro терминале |
| Xcode Debugger | Нативный код (Objective-C/Swift), память, CPU | Run в Xcode |
| React DevTools | Дерево компонентов, пропсы, состояние | `Shift+M` в Metro → выберите |
| Network Inspector | HTTP-запросы | Dev Menu → Network |
| Console Logs | `console.log` вывод | Metro терминал |

### 5.2 Отладка в Xcode

1. Откройте `.xcworkspace` в Xcode
2. Поставьте breakpoints в нативном коде
3. Run (▶) → приложение остановится на breakpoints
4. Используйте:
   - **View Debugger** (Debug → View Debugging → Capture View Hierarchy) — визуализация UI-слоёв
   - **Memory Graph** — поиск утечек памяти
   - **Instruments** — CPU, GPU, Network, Energy profiling
   - **Console** (нижняя панель) — нативные логи

### 5.3 Отладка JavaScript

```bash
# Запустите Metro с отладкой
npx expo start

# В симуляторе: Cmd+D → "Open React DevTools"
# Или нажмите "j" в терминале Metro для открытия DevTools
```

### 5.4 Отладка сетевых запросов

В проекте SimpleClaw API-клиент с интерцепторами находится в `src/api/client.ts`. Для отладки:

```typescript
// Временно добавьте в client.ts для логирования запросов:
api.interceptors.request.use(request => {
  console.log('Request:', request.method?.toUpperCase(), request.url);
  return request;
});
```

Или используйте React Native DevTools → Network tab.

### 5.5 Типичные проблемы и решения

#### Проблема: Build fails с precompiled frameworks
```
# В app.json / app.config.js:
["expo-build-properties", {
  "ios": { "buildReactNativeFromSource": true }
}]
```

#### Проблема: Pod install fails
```bash
cd ios && pod install --repo-update && cd ..
# Или полная очистка:
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
```

#### Проблема: Xcode signing errors
- Xcode → Signing & Capabilities → поменяйте Team
- Измените Bundle Identifier на уникальный

#### Проблема: Симулятор не запускается
```bash
# Сбросьте симулятор
xcrun simctl shutdown all
xcrun simctl erase all
```

#### Проблема: Metro bundler cache
```bash
npx expo start --clear
# Или:
watchman watch-del-all
rm -rf node_modules/.cache
```

---

## Часть 6: Использование Claude Code в разработке

### 6.1 Запуск Claude Code в проекте

```bash
cd simpleclaw-rn-foreign
claude
```

Claude Code автоматически определит проект как React Native/Expo и получит контекст из структуры файлов.

### 6.2 Типичные команды и сценарии

#### Добавление нового экрана:
```
> Создай новый экран SettingsScreen с переключателями для уведомлений и темы.
> Используй существующие UI-компоненты из src/components/ui/
```

Claude Code:
- Прочитает существующие экраны для понимания паттернов
- Создаст экран в `src/screens/`
- Добавит маршрут в `navigationStore`
- Использует существующие компоненты и стили NativeWind

#### Исправление бага:
```
> Чат не отправляет сообщения после переподключения WebSocket. Посмотри chatStore.ts
```

Claude Code:
- Прочитает `src/stores/chatStore.ts`
- Проанализирует WebSocket-логику
- Найдёт причину и предложит fix

#### Работа с API:
```
> Добавь новый эндпоинт для получения истории сессий в src/api/
```

Claude Code:
- Посмотрит существующие API-клиенты (`authApi.ts`, `profileApi.ts`)
- Создаст новый файл по тому же паттерну с Axios

#### Создание коммита:
```
> /commit
```

Claude Code автоматически проанализирует изменения и создаст осмысленный commit message.

### 6.3 Полезные паттерны работы с Claude Code

1. **Исследование перед изменениями:**
   ```
   > Объясни, как работает авторизация в этом проекте
   ```

2. **Рефакторинг с контекстом:**
   ```
   > Перенеси логику из ChatScreen.tsx в отдельный хук useChatMessages
   ```

3. **Отладка ошибок сборки:**
   ```
   > Xcode выдаёт ошибку "Module 'ExpoModulesCore' not found". Помоги разобраться
   ```

4. **Работа с конфигурацией:**
   ```
   > Добавь новый EAS build profile "staging" с отдельным API URL
   ```

5. **Тестирование в браузере через MCP:**
   Claude Code может использовать Claude in Chrome для тестирования web-версии приложения (`npx expo start --web`), проверки UI и взаимодействия с элементами.

### 6.4 Best Practices при работе с Claude Code

- **Давайте контекст:** Указывайте конкретные файлы и описывайте ожидаемое поведение
- **Используйте /commit:** Для автоматического создания качественных коммитов
- **Просите объяснения:** Перед сложными изменениями спросите, как Claude планирует их реализовать
- **Итеративный подход:** Делайте небольшие изменения, тестируйте, двигайтесь дальше
- **CLAUDE.md:** Создайте файл `CLAUDE.md` в корне проекта с правилами и контекстом для Claude Code

---

## Часть 7: Полный рабочий цикл (от идеи до тестирования)

### Пример: Добавление экрана настроек

```
Шаг 1: Планирование
$ claude
> Я хочу добавить экран настроек. Посмотри, как устроены другие экраны,
> и предложи план.

Шаг 2: Реализация
> Создай SettingsScreen по плану. Используй Zustand для хранения настроек.

Шаг 3: Локальный запуск
$ npx expo run:ios
# Проверяем на симуляторе

Шаг 4: Тестирование на устройстве
# Откройте ios/*.xcworkspace в Xcode → Run на устройстве

Шаг 5: Отладка (если нужно)
> В настройках не сохраняется выбор темы. Посмотри store и SecureStorage.

Шаг 6: Коммит
> /commit

Шаг 7: Сборка для тестирования
$ eas build --profile preview --platform ios
```

---

## Часть 8: Шпаргалка по командам

| Задача | Команда |
|---|---|
| Запуск Metro | `npx expo start` |
| Запуск на iOS-симуляторе | `npx expo run:ios` |
| Запуск на Android | `npx expo run:android` |
| Очистка кэша Metro | `npx expo start --clear` |
| Генерация нативного проекта | `npx expo prebuild --platform ios` |
| Очистка нативного проекта | `npx expo prebuild --clean --platform ios` |
| Открыть в Xcode | `open ios/*.xcworkspace` |
| EAS: dev build iOS | `eas build --profile development --platform ios` |
| EAS: preview build | `eas build --profile preview --platform ios` |
| EAS: production build | `eas build --profile production --platform ios` |
| EAS: локальная сборка | `eas build --profile development --platform ios --local` |
| Список симуляторов | `xcrun simctl list devices` |
| Сброс симуляторов | `xcrun simctl erase all` |
| Установка app на симулятор | `xcrun simctl install booted path/to/app` |
| Логин в EAS | `eas login` |
| Claude Code | `claude` |

---

## Файлы проекта, на которые стоит обратить внимание

- `app.json` — конфигурация Expo, плагины, bundle ID
- `eas.json` — профили сборки EAS
- `src/config/appConfig.ts` — runtime-конфигурация (API URL)
- `src/api/client.ts` — Axios с auth-интерцепторами
- `src/stores/authStore.ts` — авторизация (Google, Apple)
- `app/_layout.tsx` — корневой layout приложения
- `app/index.tsx` — главный роутер

## Верификация

После настройки окружения проверьте:
1. `npx expo start` — Metro запускается без ошибок
2. `npx expo run:ios` — приложение собирается и запускается на симуляторе
3. Авторизация работает (Google/Apple Sign-In)
4. WebSocket-чат подключается к серверу
5. Навигация между экранами работает корректно
