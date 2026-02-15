<script setup lang="ts">
import { ref, inject, onMounted } from "vue";
import type { Ref } from "vue";
import {
  registerDesktop,
  setupOpenclaw,
  deployOpenclaw,
  applyOptimizations,
} from "../lib/api";
import { Loader2, Check, X } from "lucide-vue-next";

const emit = defineEmits<{ done: [] }>();

const botToken = inject<Ref<string>>("botToken")!;
const selectedModel = inject<Ref<string>>("selectedModel")!;
const authToken = inject<Ref<string>>("authToken")!;
const openrouterKey = inject<Ref<string>>("openrouterKey")!;
const gatewayToken = inject<Ref<string>>("gatewayToken")!;

interface Step {
  label: string;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

const steps = ref<Step[]>([
  { label: "Registering...", status: "pending" },
  { label: "Generating config...", status: "pending" },
  { label: "Building containers...", status: "pending" },
  { label: "Applying optimizations...", status: "pending" },
  { label: "Verifying...", status: "pending" },
]);

const failed = ref(false);

function setStatus(index: number, status: Step["status"], error?: string) {
  steps.value[index].status = status;
  if (error) steps.value[index].error = error;
}

async function run() {
  try {
    setStatus(0, "running");
    const reg = await registerDesktop(botToken.value, selectedModel.value);
    openrouterKey.value = reg.openrouter_key;
    gatewayToken.value = reg.gateway_token;
    authToken.value = reg.auth_token;
    setStatus(0, "done");

    setStatus(1, "running");
    await setupOpenclaw({
      openrouter_key: reg.openrouter_key,
      bot_token: botToken.value,
      gateway_token: reg.gateway_token,
      model_slug: selectedModel.value,
    });
    setStatus(1, "done");

    setStatus(2, "running");
    await deployOpenclaw();
    setStatus(2, "done");

    setStatus(3, "running");
    await applyOptimizations(selectedModel.value);
    setStatus(3, "done");

    setStatus(4, "running");
    await new Promise((r) => setTimeout(r, 3000));
    setStatus(4, "done");

    setTimeout(() => emit("done"), 1000);
  } catch (e) {
    failed.value = true;
    const current = steps.value.findIndex((s) => s.status === "running");
    if (current >= 0) setStatus(current, "error", String(e));
  }
}

async function retry() {
  failed.value = false;
  steps.value.forEach((s) => {
    s.status = "pending";
    s.error = undefined;
  });
  run();
}

onMounted(run);
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-medium">Setting up</h2>
      <p class="text-sm text-neutral-500 mt-1">
        First install may take a few minutes.
      </p>
    </div>

    <div class="space-y-1">
      <div
        v-for="(s, i) in steps"
        :key="i"
        class="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm"
        :class="{
          'text-neutral-600': s.status === 'pending',
          'text-white': s.status === 'running',
          'text-neutral-400': s.status === 'done',
          'text-red-400': s.status === 'error',
        }"
      >
        <div class="w-4 h-4 flex items-center justify-center shrink-0">
          <Loader2 v-if="s.status === 'running'" class="w-3.5 h-3.5 animate-spin" />
          <Check v-else-if="s.status === 'done'" class="w-3.5 h-3.5 text-neutral-500" />
          <X v-else-if="s.status === 'error'" class="w-3.5 h-3.5" />
          <span v-else class="text-xs tabular-nums">{{ i + 1 }}</span>
        </div>

        <div class="flex-1 min-w-0">
          <span>{{ s.label }}</span>
          <p v-if="s.error" class="text-xs text-red-400/80 mt-0.5 truncate">
            {{ s.error }}
          </p>
        </div>
      </div>
    </div>

    <button
      v-if="failed"
      @click="retry"
      class="px-3 py-2 text-sm bg-white text-black rounded-md hover:bg-neutral-200 transition-colors"
    >
      Retry
    </button>
  </div>
</template>
