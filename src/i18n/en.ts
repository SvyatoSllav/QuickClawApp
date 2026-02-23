export const en = {
  // General
  appName: 'EasyClaw',
  support: 'Support',
  back: 'Back',
  continue: 'Continue',
  skip: 'Skip',
  loading: 'Loading...',
  errorOccurred: 'An error occurred. Please try again.',

  // Onboarding
  onboardingTitle1: 'Your marketing\nnever sleeps',
  onboardingDesc1: 'Launch campaigns, write copy, track performance — while you focus on the big picture. No more juggling ten tabs at 2 AM.',
  onboardingTitle2: 'A second brain\nfor your day',
  onboardingDesc2: 'Emails answered. Meetings prepped. Follow-ups sent. It handles the busywork so you can do the work that matters.',
  onboardingTitle3: 'Numbers that\ntell a story',
  onboardingDesc3: 'Drop in your data, get back real insights. Spot trends, track competitors, build reports — in minutes, not days.',
  getStarted: 'Get Started',

  // Auth
  signInWithApple: 'Sign in with Apple',
  signInWithGoogle: 'Sign in with Google',
  signingIn: 'Signing in...',
  signInTitle: 'Welcome to EasyClaw',
  signInSubtitle: 'Your personal AI agent, always online.',

  // Plan
  planTitle: 'Choose your plan',
  planSubtitle: 'Unlock full access to EasyClaw',
  planName: 'OpenClaw Pro',
  planPrice: '$49',
  planPeriod: '/month',
  planFeature1: 'Dedicated AI agent instance (24/7)',
  planFeature2: '$15 API credits included monthly',
  planFeature3: 'Choose from Gemini, Claude, or GPT',
  planFeature4: 'Real-time chat interface',
  restorePurchases: 'Restore Purchases',

  // Chat
  connecting: 'Connecting to your agent...',
  connectingDesc: 'Setting up your dedicated OpenClaw instance. This usually takes 1-3 minutes.',
  serverAssigning: 'Assigning server...',
  serverAssigned: 'Server assigned',
  configuringAgent: 'Configuring agent...',
  agentReady: 'Agent ready',
  typeMessage: 'Type a message...',
  send: 'Send',
  startConversation: 'Start a conversation',
  selectAgentOrType: 'Select an agent or type a message',

  // Models
  modelGemini: 'Gemini 3 Flash',
  modelClaude: 'Claude Sonnet 4',
  modelGpt: 'GPT-4o',

  // Profile
  profile: 'Profile',
  currentPlan: 'Current Plan',
  usage: 'Usage',
  usageOf: 'of',
  apiCredits: 'API credits',
  validUntil: 'Valid until',
  manageSubscription: 'Manage Subscription',
  cancelSubscription: 'Cancel Subscription',
  cancelConfirm: 'Are you sure you want to cancel your subscription?',
  subscriptionCancelled: 'Subscription cancelled. It will remain active until the end of the current period.',
  noSubscription: 'No active subscription',
  upgradePlan: 'Upgrade Plan',
  logout: 'Log out',

  // Integrations
  integrations: 'Integrations',
  telegramConnect: 'Connect Telegram',
  telegramPairing: 'Pair Your Account',
  connected: 'Connected',
  tapToConnect: 'Tap to connect',
  comingSoon: 'Coming Soon',

  // Telegram Setup
  howToGetToken: 'How to get a bot token:',
  tgStep1: 'Open @BotFather in Telegram',
  tgStep2: 'Send the command /newbot',
  tgStep3: 'Choose a name and username for your bot',
  tgStep4: 'Copy the token you receive',
  tgStep5: 'Paste the token below',
  botTokenLabel: 'Bot Token',
  tokenInvalidFormat: 'Invalid token format. Should be like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
  saveAndConnect: 'Save & Connect',
  botConnected: 'Bot connected',
  disconnectBot: 'Disconnect Bot',

  // Pairing
  pairingInstructions: 'Send any message to your bot in Telegram. You will receive an 8-character pairing code. Enter it below to approve access.',
  pairingCodeLabel: 'Pairing Code',
  pairingApprove: 'Approve',
  pairingSuccess: 'Pairing approved!',
  pairingSuccessDesc: 'Your bot is ready to use. Send a message in Telegram to start chatting.',
  pairingWaitServer: 'Waiting for server to be ready...',
  pairingExpireNote: 'Codes expire after 1 hour',

  // Sidebar
  menu: 'Menu',
  sessions: 'Sessions',
  agents: 'Agents',
  skills: 'Skills',
  files: 'Files',
  management: 'MANAGEMENT',
  analytics: 'Analytics',
  server: 'Server',
  training: 'Training',

  // Skills screen
  skillsTitle: 'Skills',
  skillsDescription: 'Ready-made setups that teach your assistant new tricks. Pick one — and it will guide you through everything.',

  // Files screen
  filesTitle: 'Files',
  filesOnServer: 'Files on server',
} as const;
