export type ModelId =
  | 'claude-sonnet-4'
  | 'claude-opus-4.5'
  | 'claude-sonnet-4.5'
  | 'claude-haiku-4.5'
  | 'gpt-4o'
  | 'gemini-3-flash'
  | 'gemini-2.5-flash'
  | 'minimax-m2.5';

export interface ModelOption {
  id: ModelId;
  label: string;
  icon: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4', icon: 'claude' },
  { id: 'claude-opus-4.5', label: 'Claude Opus 4.5', icon: 'claude' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', icon: 'claude' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', icon: 'claude' },
  { id: 'gpt-4o', label: 'GPT-4o', icon: 'gpt' },
  { id: 'gemini-3-flash', label: 'Gemini 3 Flash', icon: 'gemini' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', icon: 'gemini' },
  { id: 'minimax-m2.5', label: 'MiniMax M2.5', icon: 'minimax' },
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatAttachment {
  uri: string;
  base64: string;
  mimeType: string;
  fileName: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
