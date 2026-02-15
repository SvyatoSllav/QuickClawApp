<script setup lang="ts">
import { ref, inject } from "vue";
import type { Ref } from "vue";
import { validateBotToken } from "../lib/api";
import { Loader2, Check } from "lucide-vue-next";

const emit = defineEmits<{ next: [] }>();

const botToken = inject<Ref<string>>("botToken")!;
const botName = inject<Ref<string>>("botName")!;
const botUsername = inject<Ref<string>>("botUsername")!;

const tokenInput = ref(botToken.value);
const validating = ref(false);
const validated = ref(false);
const error = ref("");

async function validate() {
  const token = tokenInput.value.trim();
  if (!token) {
    error.value = "Enter a bot token";
    return;
  }

  validating.value = true;
  error.value = "";
  validated.value = false;

  try {
    const info = await validateBotToken(token);
    if (info.valid) {
      botToken.value = token;
      botName.value = info.bot_name;
      botUsername.value = info.bot_username;
      validated.value = true;
      setTimeout(() => emit("next"), 600);
    } else {
      error.value = "Invalid bot token";
    }
  } catch (e) {
    error.value = String(e);
  } finally {
    validating.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-medium">Telegram Bot</h2>
      <p class="text-sm text-neutral-500 mt-1">
        Your AI assistant works through a Telegram bot.
      </p>
    </div>

    <div class="text-sm text-neutral-500 space-y-1 px-3 py-3 border border-neutral-800 rounded-md">
      <p class="text-neutral-400 font-medium">Create a bot:</p>
      <ol class="list-decimal list-inside space-y-0.5">
        <li>Open <span class="text-white">@BotFather</span> in Telegram</li>
        <li>Send <code class="text-neutral-300">/newbot</code></li>
        <li>Copy the token below</li>
      </ol>
    </div>

    <div class="space-y-3">
      <input
        v-model="tokenInput"
        type="text"
        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        class="w-full px-3 py-2.5 bg-transparent border border-neutral-700 rounded-md text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 font-mono text-sm"
        @keyup.enter="validate"
      />

      <div
        v-if="validated"
        class="flex items-center gap-2 px-3 py-2.5 border border-neutral-800 rounded-md text-sm"
      >
        <Check class="w-3.5 h-3.5 text-neutral-500" />
        <span class="text-neutral-300">{{ botName }}</span>
        <span class="text-neutral-600">@{{ botUsername }}</span>
      </div>

      <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

      <button
        @click="validate"
        :disabled="validating || !tokenInput.trim()"
        class="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white text-black rounded-md hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 transition-colors"
      >
        <Loader2 v-if="validating" class="w-3.5 h-3.5 animate-spin" />
        {{ validating ? "Validating..." : "Validate" }}
      </button>
    </div>
  </div>
</template>
