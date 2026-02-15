<script setup lang="ts">
import { inject } from "vue";
import type { Ref } from "vue";
const emit = defineEmits<{ next: [] }>();

const selectedModel = inject<Ref<string>>("selectedModel")!;

interface ModelOption {
  slug: string;
  name: string;
  provider: string;
  speed: number;
  cost: number;
  badge?: string;
}

const models: ModelOption[] = [
  {
    slug: "gemini-3-flash",
    name: "Gemini 3 Flash",
    provider: "Google",
    speed: 3,
    cost: 1,
    badge: "Default",
  },
  {
    slug: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    speed: 2,
    cost: 2,
  },
  {
    slug: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    speed: 2,
    cost: 2,
  },
];

const providerIcon: Record<string, string> = {
  Google:
    '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
  Anthropic:
    '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M13.83 1.5L21.5 22.5h-4.4l-1.92-5.25H8.82L6.9 22.5H2.5L10.17 1.5h3.66zm-.73 12.25L11.5 8.67 9.9 13.75h3.2z"/></svg>',
  OpenAI:
    '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M22.28 9.37a5.93 5.93 0 00-.51-4.88 6.01 6.01 0 00-6.44-3.39 5.97 5.97 0 00-4.52 2.07 5.94 5.94 0 00-3.94-1.47 6.01 6.01 0 00-5.74 4.17 5.96 5.96 0 00.73 5.64 5.93 5.93 0 00.51 4.88 6.01 6.01 0 006.44 3.39 5.97 5.97 0 004.52-2.07 5.94 5.94 0 003.94 1.47 6.01 6.01 0 005.74-4.17 5.96 5.96 0 00-.73-5.64zM15.1 21.37a4.47 4.47 0 01-2.87-1.04l.14-.08 4.78-2.76a.78.78 0 00.39-.67v-6.74l2.02 1.17a.07.07 0 01.04.05v5.58a4.49 4.49 0 01-4.5 4.49zM3.6 17.6a4.46 4.46 0 01-.53-3.02l.14.08 4.78 2.76a.77.77 0 00.78 0l5.83-3.37v2.33a.07.07 0 01-.03.06l-4.83 2.79a4.49 4.49 0 01-6.14-1.63zM2.34 7.89A4.46 4.46 0 014.68 6.2v.16l.01 5.52a.77.77 0 00.39.67l5.83 3.37-2.02 1.17a.07.07 0 01-.06 0L4 14.3a4.49 4.49 0 01-1.66-6.41zm16.5 3.83l-5.83-3.37 2.02-1.17a.07.07 0 01.06 0l4.83 2.79a4.49 4.49 0 01-.69 7.89v-5.72a.77.77 0 00-.39-.67v.25zm2.01-3.03l-.14-.08-4.78-2.76a.77.77 0 00-.78 0l-5.83 3.37V6.89a.07.07 0 01.03-.06l4.83-2.79a4.49 4.49 0 016.67 4.64zM8.22 13.49l-2.02-1.17a.07.07 0 01-.04-.05V6.69a4.49 4.49 0 017.37-3.45l-.14.08-4.78 2.76a.78.78 0 00-.39.67v6.74zm1.1-2.37l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5v-3z"/></svg>',
};

function select(slug: string) {
  selectedModel.value = slug;
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-medium">Model</h2>
      <p class="text-sm text-neutral-500 mt-1">
        Choose the AI model. You can change this later.
      </p>
    </div>

    <div class="space-y-2">
      <button
        v-for="m in models"
        :key="m.slug"
        @click="select(m.slug)"
        class="w-full text-left px-3 py-3 rounded-md border transition-all flex items-center gap-3"
        :class="
          selectedModel === m.slug
            ? 'border-neutral-500 bg-neutral-900'
            : 'border-neutral-800 hover:border-neutral-700'
        "
      >
        <div
          class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          :class="
            selectedModel === m.slug
              ? 'border-white'
              : 'border-neutral-700'
          "
        >
          <div
            v-if="selectedModel === m.slug"
            class="w-2 h-2 rounded-full bg-white"
          />
        </div>

        <div
          class="shrink-0 text-neutral-500"
          v-html="providerIcon[m.provider]"
        />

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ m.name }}</span>
            <span
              v-if="m.badge"
              class="text-[10px] uppercase tracking-wider text-neutral-500 border border-neutral-700 px-1.5 py-0.5 rounded"
            >
              {{ m.badge }}
            </span>
          </div>
          <div class="flex items-center gap-3 mt-0.5 text-xs text-neutral-600">
            <span>{{ "\u25CF".repeat(m.speed) + "\u25CB".repeat(3 - m.speed) }} speed</span>
            <span>{{ "$".repeat(m.cost) }}</span>
          </div>
        </div>
      </button>
    </div>

    <button
      @click="emit('next')"
      class="px-3 py-2 text-sm bg-white text-black rounded-md hover:bg-neutral-200 transition-colors"
    >
      Continue
    </button>
  </div>
</template>
