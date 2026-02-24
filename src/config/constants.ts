export const TIMING = {
  HEALTH_WATCHDOG_MS: 60_000,
  KEEPALIVE_INTERVAL_MS: 30_000,
  RECONNECT_DELAY_MS: 2_000,
  ANIMATION_DURATION_MS: 280,
  LONGPRESS_DELAY_MS: 400,
} as const;

export const CHAT_INPUT = {
  MIN_HEIGHT: 48,
  MAX_HEIGHT: 160,
  MAX_LENGTH: 4000,
} as const;

export const PAGINATION = {
  SKILLS_PAGE_SIZE: 5,
  MAX_VISIBLE_PAGES: 5,
} as const;

export const WS_MESSAGE_TYPES = {
  REQUEST: 'req',
  RESPONSE: 'res',
  EVENT: 'event',
  PING: 'ping',
} as const;
