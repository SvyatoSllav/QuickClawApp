<script setup lang="ts">
import { ref, onMounted } from "vue";
import { checkDocker, getDockerInstallUrl, isLinux } from "../lib/api";
import type { DockerStatus } from "../lib/api";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, X, Loader2, ExternalLink } from "lucide-vue-next";

const emit = defineEmits<{ next: [] }>();

const status = ref<DockerStatus | null>(null);
const checking = ref(true);
const linux = ref(false);
const error = ref("");

async function check() {
  checking.value = true;
  error.value = "";
  try {
    status.value = await checkDocker();
    linux.value = await isLinux();
    if (status.value.installed && status.value.compose && status.value.running) {
      setTimeout(() => emit("next"), 800);
    }
  } catch (e) {
    error.value = String(e);
  } finally {
    checking.value = false;
  }
}

async function openInstallPage() {
  const url = await getDockerInstallUrl();
  await openUrl(url);
}

onMounted(check);
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-medium">Docker</h2>
      <p class="text-sm text-neutral-500 mt-1">
        OpenClaw runs in Docker containers on your machine.
      </p>
    </div>

    <div v-if="checking" class="flex items-center gap-2 text-neutral-500 text-sm">
      <Loader2 class="w-4 h-4 animate-spin" />
      Checking...
    </div>

    <div v-else-if="status" class="space-y-2">
      <div
        v-for="item in [
          { ok: status.installed, label: status.installed ? `Docker ${status.version}` : 'Docker not found' },
          { ok: status.compose, label: status.compose ? 'Compose available' : 'Compose not found', show: status.installed },
          { ok: status.running, label: status.running ? 'Daemon running' : 'Daemon stopped', show: status.installed },
        ]"
        :key="item.label"
      >
        <div
          v-if="item.show !== false"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm"
          :class="item.ok ? 'border-neutral-800 text-neutral-300' : 'border-neutral-800 text-neutral-400'"
        >
          <Check v-if="item.ok" class="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <X v-else class="w-3.5 h-3.5 text-neutral-600 shrink-0" />
          {{ item.label }}
        </div>
      </div>

      <div v-if="!status.installed || !status.compose" class="pt-3 space-y-2">
        <p class="text-sm text-neutral-500">Install Docker Desktop to continue.</p>
        <button
          @click="openInstallPage"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-white text-black rounded-md hover:bg-neutral-200 transition-colors"
        >
          Download Docker
          <ExternalLink class="w-3.5 h-3.5" />
        </button>
      </div>

      <div v-else-if="!status.running" class="pt-3">
        <p class="text-sm text-neutral-500">Start Docker Desktop, then retry.</p>
      </div>

      <div class="flex gap-2 pt-3">
        <button
          v-if="!(status.installed && status.compose && status.running)"
          @click="check"
          class="px-3 py-2 text-sm border border-neutral-700 rounded-md hover:bg-neutral-900 transition-colors"
        >
          Retry
        </button>
        <button
          v-if="status.installed && status.compose && status.running"
          @click="emit('next')"
          class="px-3 py-2 text-sm bg-white text-black rounded-md hover:bg-neutral-200 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
  </div>
</template>
