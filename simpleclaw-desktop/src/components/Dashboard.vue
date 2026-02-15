<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";
import {
  getOpenclawStatus,
  getOpenclawLogs,
  startOpenclaw,
  stopOpenclaw,
  restartOpenclaw,
  checkUsage,
  createPayment,
  getProfile,
} from "../lib/api";
import type { OpenClawStatus, UsageResponse, ProfileResponse } from "../lib/api";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Play,
  Square,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CreditCard,
  User,
} from "lucide-vue-next";

const emit = defineEmits<{ reset: [] }>();

const authToken = inject<Ref<string>>("authToken")!;

const status = ref<OpenClawStatus | null>(null);
const usage = ref<UsageResponse | null>(null);
const logs = ref("");
const actionLoading = ref("");
const showLogs = ref(false);
const showProfile = ref(false);
const paymentLoading = ref(false);
const profile = ref<ProfileResponse | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
  try {
    status.value = await getOpenclawStatus();
  } catch {
    // ignore
  }
}

async function refreshUsage() {
  if (!authToken.value) return;
  try {
    usage.value = await checkUsage(authToken.value);
  } catch {
    // ignore
  }
}

async function refreshLogs() {
  try {
    logs.value = await getOpenclawLogs(100);
  } catch {
    // ignore
  }
}

async function doStart() {
  actionLoading.value = "start";
  try {
    await startOpenclaw();
    await refresh();
  } finally {
    actionLoading.value = "";
  }
}

async function doStop() {
  actionLoading.value = "stop";
  try {
    await stopOpenclaw();
    await refresh();
  } finally {
    actionLoading.value = "";
  }
}

async function doRestart() {
  actionLoading.value = "restart";
  try {
    await restartOpenclaw();
    await refresh();
  } finally {
    actionLoading.value = "";
  }
}

async function handlePayment() {
  if (!authToken.value) return;
  paymentLoading.value = true;
  try {
    const resp = await createPayment(authToken.value);
    if (resp.confirmation_url) {
      await openUrl(resp.confirmation_url);
    }
  } catch {
    // ignore
  } finally {
    paymentLoading.value = false;
  }
}

function openWebUI() {
  openUrl("http://localhost:18789");
}

async function refreshProfile() {
  if (!authToken.value) return;
  try {
    profile.value = await getProfile(authToken.value);
  } catch {
    // ignore
  }
}

function toggleLogs() {
  showLogs.value = !showLogs.value;
  if (showLogs.value) refreshLogs();
}

onMounted(() => {
  refresh();
  refreshUsage();
  refreshProfile();
  pollTimer = setInterval(() => {
    refresh();
    if (showLogs.value) refreshLogs();
  }, 5000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div class="space-y-4">
    <!-- Status -->
    <div class="flex items-center justify-between px-3 py-3 border border-neutral-800 rounded-md">
      <div class="flex items-center gap-2">
        <div
          class="w-2 h-2 rounded-full"
          :class="status?.running ? 'bg-white' : 'bg-neutral-600'"
        />
        <span class="text-sm font-medium">
          {{ status?.running ? "Running" : "Stopped" }}
        </span>
      </div>
      <button
        v-if="status?.running"
        @click="openWebUI"
        class="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
      >
        Web UI
        <ExternalLink class="w-3 h-3" />
      </button>
    </div>

    <!-- Containers -->
    <div v-if="status?.containers.length" class="px-3 py-2 border border-neutral-800 rounded-md">
      <div
        v-for="c in status.containers"
        :key="c.name"
        class="flex items-center justify-between py-1.5 text-xs"
      >
        <span class="font-mono text-neutral-400">{{ c.name }}</span>
        <span
          :class="c.state === 'running' ? 'text-neutral-300' : 'text-neutral-600'"
        >
          {{ c.state }}
        </span>
      </div>
    </div>

    <!-- Usage -->
    <div v-if="usage" class="px-3 py-3 border border-neutral-800 rounded-md space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="text-neutral-500">Usage</span>
        <span class="text-neutral-400 tabular-nums">
          ${{ usage.used.toFixed(2) }} / ${{ usage.limit.toFixed(2) }}
        </span>
      </div>
      <div class="w-full bg-neutral-800 rounded-full h-1">
        <div
          class="h-1 rounded-full bg-white transition-all"
          :style="{ width: Math.min(100, (usage.used / usage.limit) * 100) + '%' }"
        />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-xs text-neutral-600">
          ${{ usage.remaining.toFixed(2) }} remaining
        </span>
        <button
          @click="handlePayment"
          :disabled="paymentLoading"
          class="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          <CreditCard class="w-3 h-3" />
          {{ paymentLoading ? "..." : "Top up" }}
        </button>
      </div>
    </div>

    <!-- Profile -->
    <div v-if="profile" class="px-3 py-3 border border-neutral-800 rounded-md space-y-2">
      <button
        @click="showProfile = !showProfile"
        class="flex items-center justify-between w-full text-xs"
      >
        <div class="flex items-center gap-2">
          <User class="w-3 h-3 text-neutral-500" />
          <span class="text-neutral-400">{{ profile.email }}</span>
        </div>
        <component :is="showProfile ? ChevronUp : ChevronDown" class="w-3 h-3 text-neutral-500" />
      </button>

      <div v-if="showProfile" class="space-y-1.5 pt-2 border-t border-neutral-800">
        <div class="flex justify-between text-xs">
          <span class="text-neutral-600">Bot</span>
          <span class="text-neutral-400">@{{ profile.profile.telegram_bot_username || '—' }}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-neutral-600">Model</span>
          <span class="text-neutral-400">{{ profile.profile.selected_model || '—' }}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-neutral-600">Subscription</span>
          <span
            :class="profile.profile.subscription_status === 'active' ? 'text-neutral-300' : 'text-neutral-600'"
            class="text-xs"
          >{{ profile.profile.subscription_status || 'none' }}</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex gap-2">
      <button
        @click="doStart"
        :disabled="!!actionLoading || status?.running"
        class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-md border border-neutral-700 hover:bg-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Play class="w-3 h-3" />
        Start
      </button>
      <button
        @click="doStop"
        :disabled="!!actionLoading || !status?.running"
        class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-md border border-neutral-700 hover:bg-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <Square class="w-3 h-3" />
        Stop
      </button>
      <button
        @click="doRestart"
        :disabled="!!actionLoading || !status?.running"
        class="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded-md border border-neutral-700 hover:bg-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
      >
        <RotateCw class="w-3 h-3" />
        Restart
      </button>
    </div>

    <!-- Logs -->
    <div>
      <button
        @click="toggleLogs"
        class="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <component :is="showLogs ? ChevronUp : ChevronDown" class="w-3 h-3" />
        Logs
      </button>

      <div
        v-if="showLogs"
        class="mt-2 bg-neutral-950 border border-neutral-800 rounded-md p-3 font-mono text-[11px] text-neutral-500 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed"
      >
        {{ logs || "No logs" }}
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-center pt-2 border-t border-neutral-800">
      <button
        @click="refreshUsage"
        class="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        Refresh
      </button>
      <button
        @click="emit('reset')"
        class="text-xs text-neutral-700 hover:text-red-400 transition-colors"
      >
        Reset
      </button>
    </div>
  </div>
</template>
