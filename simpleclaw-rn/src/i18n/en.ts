export const en = {
  appTitle: 'SimpleClaw.com',
  support: 'Support',
  profile: 'Profile',
  logout: 'Log out',

  heroTitle: 'Deploy OpenClaw in less than 1 minute',
  heroSubtitle:
    'Skip the technical complexity and deploy your own OpenClaw instance running 24/7 with a single click.',

  modelQuestion: 'Which model would you like to use by default?',
  channelQuestion: 'Which channel would you like to use for messaging?',

  loginButton: 'Sign in with Google',
  loginAppleButton: ' Sign in with Apple',
  loginLoading: 'Signing in...',

  serversLimited: 'Servers are limited — remaining',
  noServers:
    'Unfortunately, all servers are busy. Please try again in 5 minutes.',

  loginPrompt:
    'Sign in to deploy your AI assistant and connect channels.',
  authPrompt: 'Tap the Telegram button and enter your bot token',
  authPromptPart1: 'Tap the ',
  authPromptPart2: ' button and enter your bot token',

  comparison: 'Comparison',
  comparisonTitle: 'Traditional method vs SimpleClaw',
  traditional: 'Traditional',
  total: 'Total',
  threeHours: '3 hours',
  lessThanOneMin: '<1 min',

  price: '2999 RUB/mo',
  oldPrice: '7999 RUB',
  apiCredits: '$15 API credits included monthly',
  simpleclawDesc:
    'Choose a model, connect Telegram, deploy — done.',

  useCasesTitle: 'What can OpenClaw do for you?',
  useCasesSubtitle: 'One assistant, thousands of scenarios',
  soon: 'Soon',

  connectTelegram: 'Connect Telegram',
  howToGetToken: 'How to get a bot token?',
  tokenLabel: 'Bot token',
  tokenPlaceholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
  tokenError:
    'Invalid token format. Token should be like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
  saveAndConnect: 'Save and connect',
  saving: 'Loading...',

  serverSetup: 'Setting up your server...',
  botReady: 'Your bot is ready!',
  paymentSuccess:
    'Payment successful. Deployment takes 3-5 minutes.',
  botReadyDesc: 'OpenClaw is deployed and ready to go. Message your bot!',

  paymentDone: 'Payment complete',
  serverAssigning: 'Assigning server...',
  serverAssigned: 'Server assigned',
  openclawConfiguring: 'Configuring OpenClaw...',
  openclawConfigured: 'OpenClaw configured',
  openclawPending: 'OpenClaw setup',
  writeBotTelegram: 'Message your bot on Telegram!',

  openProfile: 'Open profile',
  deployError:
    'An error occurred during setup. Please contact support.',

  subscription: 'Subscription',
  statusLabel: 'Status',
  active: 'Active',
  validUntil: 'Valid until',
  used: 'Used',
  cancelSubscription: 'Cancel subscription',
  cancelConfirm: 'Are you sure you want to cancel your subscription?',
  noSubscription: 'No active subscription',
  subscriptionEnding: 'Subscription ending',

  back: 'Back',
  serverSetupTitle: 'Server setup',

  openclawActive: 'Your OpenClaw is active!',
  openclawActiveDesc:
    'Message your bot and make sure everything works!',

  pairingIntro: 'If the bot sent you a message like:',
  pairingCode:
    'OpenClaw: access not configured.\nYour Telegram user id: <Your telegram id>\nPairing code: XXXXXXXX',
  pairingExplanation:
    "Don't worry, this is not an error — your account is being remembered. This is done for security. Just wait a couple of minutes and try again.",

  author: 'Tarasov Svyatoslav',
  contact: 'Contact',
  agreement: 'Agreement',
  privacyPolicy: 'Privacy Policy',

  errorOccurred: 'An error occurred. Please contact support.',
  subscriptionCancelled:
    'Subscription cancelled. It will remain active until the end of the paid period.',

  minuteShort: 'min',

  // Comparison section steps
  stepBuyServer: 'Choose and buy a server',
  stepCreateSSH: 'Create SSH keys',
  stepConnectOS: 'Connect and configure OS',
  stepInstallDocker: 'Install Docker and dependencies',
  stepInstallOpenClaw: 'Install and build OpenClaw',
  stepConfigureSettings: 'Configure settings',
  stepConnectTelegram: 'Connect Telegram and test',

  // Telegram modal steps
  tgStep1Open: 'Open ',
  tgStep1BotFather: '@BotFather',
  tgStep1InTelegram: ' in Telegram',
  tgStep2Send: 'Send the command ',
  tgStep3: 'Choose a name and username for your bot',
  tgStep4: 'Copy the received token',
  tgStep5: 'Paste the token below and tap "Save"',

  // Footer articles
  articleInstall: 'How to install OpenClaw',
  articleWhat: 'What is OpenClaw',
  articleTop5: 'Top 5 ways',

  // Marquee rows
  marqueeRow1: ['Reading emails', 'Composing replies', 'Translating messages', 'Organizing mail', 'Customer support', 'Summarization', 'Reminders'],
  marqueeRow2: ['Weekly planning', 'Meeting notes', 'Expense tracking', 'Managing subscriptions', 'Deadlines', 'Sync'],
  marqueeRow3: ['Finding coupons', 'Price comparison', 'Product analysis', 'Salary calculation', 'Refunds', 'Discounts'],
  marqueeRow4: ['Drafting contracts', 'Competitor research', 'Creating invoices', 'Booking', 'Social media posts'],
} as const;
