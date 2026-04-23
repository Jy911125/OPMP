<template>
  <div class="monitor-page page-container">
    <div class="page-header">
      <h2>系统监控</h2>
      <el-button-group>
        <el-button :type="autoRefresh ? 'primary' : 'default'" size="small" @click="autoRefresh = !autoRefresh">
          {{ autoRefresh ? '自动刷新中' : '开启自动刷新' }}
        </el-button>
        <el-button size="small" @click="refresh">手动刷新</el-button>
      </el-button-group>
    </div>

    <div class="monitor-grid">
      <!-- CPU -->
      <div class="chart-card">
        <h3><el-icon><Cpu /></el-icon> CPU 使用率</h3>
        <div class="gauge-container">
          <div class="gauge-value">{{ cpuUsage.toFixed(1) }}%</div>
          <el-progress type="dashboard" :percentage="cpuUsage" :width="180" :stroke-width="12"
            :color="getColor(cpuUsage)" />
        </div>
        <div class="info-grid">
          <div class="info-cell"><span>1分钟负载</span><span>{{ loadAvg[0]?.toFixed(2) }}</span></div>
          <div class="info-cell"><span>5分钟负载</span><span>{{ loadAvg[1]?.toFixed(2) }}</span></div>
          <div class="info-cell"><span>15分钟负载</span><span>{{ loadAvg[2]?.toFixed(2) }}</span></div>
          <div class="info-cell"><span>核心数</span><span>{{ cpuCores }}</span></div>
        </div>
      </div>

      <!-- Memory -->
      <div class="chart-card">
        <h3><el-icon><Coin /></el-icon> 内存使用</h3>
        <div class="gauge-container">
          <div class="gauge-value">{{ memUsage.toFixed(1) }}%</div>
          <el-progress type="dashboard" :percentage="memUsage" :width="180" :stroke-width="12"
            :color="getColor(memUsage)" />
        </div>
        <div class="info-grid">
          <div class="info-cell"><span>总量</span><span>{{ formatBytes(memTotal) }}</span></div>
          <div class="info-cell"><span>已用</span><span>{{ formatBytes(memUsed) }}</span></div>
          <div class="info-cell"><span>可用</span><span>{{ formatBytes(memAvailable) }}</span></div>
          <div class="info-cell"><span>Swap</span><span>{{ formatBytes(swapUsed) }} / {{ formatBytes(swapTotal) }}</span></div>
        </div>
      </div>

      <!-- Disk -->
      <div class="chart-card full-width">
        <h3><el-icon><Folder /></el-icon> 磁盘使用</h3>
        <el-table :data="disks" size="small">
          <el-table-column prop="filesystem" label="文件系统" width="160" />
          <el-table-column prop="mountPoint" label="挂载点" width="120" />
          <el-table-column label="总量" width="100">
            <template #default="{ row }">{{ formatBytes(row.total) }}</template>
          </el-table-column>
          <el-table-column label="已用" width="100">
            <template #default="{ row }">{{ formatBytes(row.used) }}</template>
          </el-table-column>
          <el-table-column label="可用" width="100">
            <template #default="{ row }">{{ formatBytes(row.available) }}</template>
          </el-table-column>
          <el-table-column label="使用率" width="200">
            <template #default="{ row }">
              <el-progress :percentage="row.usagePercent" :stroke-width="8" :color="getColor(row.usagePercent)" />
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100" />
        </el-table>
      </div>

      <!-- Network -->
      <div class="chart-card full-width">
        <h3><el-icon><Connection /></el-icon> 网络流量</h3>
        <el-table :data="networkTraffic" size="small">
          <el-table-column prop="interfaceName" label="接口" width="120" />
          <el-table-column label="接收速率" width="150">
            <template #default="{ row }">{{ formatSpeed(row.rxBytesPerSec) }}/s</template>
          </el-table-column>
          <el-table-column label="发送速率" width="150">
            <template #default="{ row }">{{ formatSpeed(row.txBytesPerSec) }}/s</template>
          </el-table-column>
          <el-table-column label="接收包/秒" width="130">
            <template #default="{ row }">{{ row.rxPacketsPerSec?.toFixed(0) }}</template>
          </el-table-column>
          <el-table-column label="发送包/秒" width="130">
            <template #default="{ row }">{{ row.txPacketsPerSec?.toFixed(0) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useMonitorStore } from '@/stores/monitor';

const monitorStore = useMonitorStore();
const autoRefresh = ref(true);

const cpuUsage = computed(() => monitorStore.snapshot?.cpu.usage || 0);
const loadAvg = computed(() => monitorStore.snapshot?.cpu.loadAvg || [0, 0, 0]);
const cpuCores = computed(() => monitorStore.snapshot?.cpu.cores?.length || 0);
const memUsage = computed(() => monitorStore.snapshot?.memory.usagePercent || 0);
const memTotal = computed(() => monitorStore.snapshot?.memory.total || 0);
const memUsed = computed(() => monitorStore.snapshot?.memory.used || 0);
const memAvailable = computed(() => monitorStore.snapshot?.memory.available || 0);
const swapUsed = computed(() => monitorStore.snapshot?.memory.swapUsed || 0);
const swapTotal = computed(() => monitorStore.snapshot?.memory.swapTotal || 0);
const disks = computed(() => monitorStore.snapshot?.disks || []);
const networkTraffic = computed(() => monitorStore.snapshot?.network || []);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bps: number): string { return formatBytes(bps); }

function getColor(val: number): string {
  if (val < 60) return '#22c55e';
  if (val < 80) return '#f59e0b';
  return '#ef4444';
}

async function refresh() {
  await monitorStore.fetchSnapshot();
}

onMounted(() => {
  if (autoRefresh.value) monitorStore.connectWebSocket();
  refresh();
});

onUnmounted(() => {
  if (!autoRefresh.value) monitorStore.disconnectWebSocket();
});
</script>

<style scoped lang="scss">
.monitor-page { display: flex; flex-direction: column; gap: 16px; }

.page-header {
  display: flex; justify-content: space-between; align-items: center;
  h2 { font-size: 18px; font-weight: 600; }
}

.monitor-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

.chart-card {
  &.full-width { grid-column: 1 / -1; }
  h3 { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--opmp-text-secondary); margin-bottom: 12px; }
}

.gauge-container {
  display: flex; flex-direction: column; align-items: center; position: relative;
  .gauge-value { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; font-weight: 700; }
}

.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }

.info-cell {
  display: flex; justify-content: space-between; padding: 4px 8px; background: var(--opmp-bg); border-radius: 4px; font-size: 13px;
  span:first-child { color: var(--opmp-text-secondary); }
}
</style>
