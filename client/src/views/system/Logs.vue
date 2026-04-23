<template>
  <div class="logs-page page-container">
    <div class="page-header">
      <h2>系统日志</h2>
      <div class="header-actions">
        <el-select v-model="selectedUnit" placeholder="服务" style="width: 200px" size="small" clearable filterable>
          <el-option v-for="u in units" :key="u" :value="u" />
        </el-select>
        <el-input v-model="filter" placeholder="搜索关键字..." style="width: 200px" size="small" clearable />
        <el-button size="small" @click="loadLogs">刷新</el-button>
      </div>
    </div>

    <div class="log-container" v-loading="loading">
      <pre class="log-content">{{ filteredLogs }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { logsApi } from '@/api';

const logs = ref('');
const loading = ref(false);
const selectedUnit = ref('');
const filter = ref('');
const lines = ref(500);
const units = ['nginx', 'docker', 'sshd', 'systemd', 'cron', 'journald'];

const filteredLogs = computed(() => {
  if (!filter.value) return logs.value;
  return logs.value.split('\n').filter(l => l.toLowerCase().includes(filter.value.toLowerCase())).join('\n');
});

async function loadLogs() {
  loading.value = true;
  try {
    const res: any = await logsApi.get({ unit: selectedUnit.value || undefined, lines: lines.value });
    logs.value = res.logs || '';
  } finally { loading.value = false; }
}

watch(selectedUnit, loadLogs);

onMounted(loadLogs);
</script>

<style scoped lang="scss">
.logs-page { display: flex; flex-direction: column; gap: 12px; height: 100%; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; }
.log-container {
  flex: 1; background: var(--opmp-bg-card); border: 1px solid var(--opmp-border); border-radius: 8px; padding: 12px; overflow: hidden;
}
.log-content {
  font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; line-height: 1.5; color: var(--opmp-text); margin: 0; white-space: pre-wrap; word-break: break-all; height: 100%; overflow-y: auto;
}
</style>
