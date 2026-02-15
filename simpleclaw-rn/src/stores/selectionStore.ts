import { create } from 'zustand';

interface SelectionState {
  selectedModel: string;
  selectedChannel: string | null;
  setModel: (model: string) => void;
  setChannel: (channel: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedModel: 'gemini-3-flash',
  selectedChannel: null,
  setModel: (model) => set({ selectedModel: model }),
  setChannel: (channel) => set({ selectedChannel: channel }),
}));
