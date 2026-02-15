<script setup lang="ts">
import { ref, computed, onMounted, provide } from "vue";
import { load } from "@tauri-apps/plugin-store";
import StepDocker from "./components/StepDocker.vue";
import StepToken from "./components/StepToken.vue";
import StepModel from "./components/StepModel.vue";
import StepSetup from "./components/StepSetup.vue";
import Dashboard from "./components/Dashboard.vue";

const step = ref(1);
const botToken = ref("");
const botName = ref("");
const botUsername = ref("");
const selectedModel = ref("gemini-3-flash");
const authToken = ref("");
const openrouterKey = ref("");
const gatewayToken = ref("");

provide("botToken", botToken);
provide("botName", botName);
provide("botUsername", botUsername);
provide("selectedModel", selectedModel);
provide("authToken", authToken);
provide("openrouterKey", openrouterKey);
provide("gatewayToken", gatewayToken);

const stepLabels = ["Docker", "Bot", "Model", "Deploy"];

const modelNames: Record<string, string> = {
  "gemini-3-flash": "Gemini 3 Flash",
  "claude-sonnet-4": "Claude Sonnet 4",
  "gpt-4o": "GPT-4o",
};

const stepSummaries = computed(() => [
  step.value > 1 ? "Ready" : "",
  step.value > 2 ? `@${botUsername.value}` : "",
  step.value > 3 ? (modelNames[selectedModel.value] || selectedModel.value) : "",
  step.value > 4 ? "Complete" : "",
]);

async function saveState() {
  const store = await load("state.json", { defaults: {}, autoSave: true });
  await store.set("step", step.value);
  await store.set("botToken", botToken.value);
  await store.set("botName", botName.value);
  await store.set("botUsername", botUsername.value);
  await store.set("selectedModel", selectedModel.value);
  await store.set("authToken", authToken.value);
  await store.set("openrouterKey", openrouterKey.value);
  await store.set("gatewayToken", gatewayToken.value);
}

async function loadState() {
  try {
    const store = await load("state.json", { defaults: {}, autoSave: true });
    const s = await store.get<number>("step");
    if (s && s >= 1 && s <= 5) step.value = s;
    botToken.value = (await store.get<string>("botToken")) || "";
    botName.value = (await store.get<string>("botName")) || "";
    botUsername.value = (await store.get<string>("botUsername")) || "";
    selectedModel.value =
      (await store.get<string>("selectedModel")) || "gemini-3-flash";
    authToken.value = (await store.get<string>("authToken")) || "";
    openrouterKey.value = (await store.get<string>("openrouterKey")) || "";
    gatewayToken.value = (await store.get<string>("gatewayToken")) || "";
  } catch {
    // First run
  }
}

function nextStep() {
  if (step.value < 5) {
    step.value++;
    saveState();
  }
}

function goToStep(s: number) {
  step.value = s;
  saveState();
}

onMounted(loadState);
</script>

<template>
  <div class="min-h-screen bg-black text-white font-sans flex flex-col">
    <header class="border-b border-neutral-800 px-5 py-3 flex items-center gap-3">
      <span class="text-sm font-medium tracking-wide uppercase text-neutral-400">
        SimpleClaw
      </span>

      <div v-if="step < 5" class="flex items-center gap-1 ml-auto text-xs">
        <template v-for="(label, i) in stepLabels" :key="i">
          <div
            class="flex items-center gap-1.5 px-2 py-1 rounded"
            :class="
              i + 1 === step
                ? 'text-white bg-neutral-800'
                : i + 1 < step
                  ? 'text-neutral-500'
                  : 'text-neutral-600'
            "
          >
            <span v-if="i + 1 < step" class="text-neutral-500">&#10003;</span>
            <span v-else class="text-neutral-600 tabular-nums">{{ i + 1 }}</span>
            <div class="flex flex-col leading-tight">
              <span>{{ label }}</span>
              <span
                v-if="i + 1 < step && stepSummaries[i]"
                class="text-[10px] text-neutral-600"
              >{{ stepSummaries[i] }}</span>
            </div>
          </div>
          <span v-if="i < 3" class="text-neutral-700">/</span>
        </template>
      </div>
    </header>

    <main class="flex-1 flex items-center justify-center p-6">
      <div class="w-full max-w-lg">
        <StepDocker v-if="step === 1" @next="nextStep" />
        <StepToken v-else-if="step === 2" @next="nextStep" />
        <StepModel v-else-if="step === 3" @next="nextStep" />
        <StepSetup v-else-if="step === 4" @done="goToStep(5)" />
        <Dashboard v-else-if="step === 5" @reset="goToStep(1)" />
      </div>
    </main>
  </div>
</template>
