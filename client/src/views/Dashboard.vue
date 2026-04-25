<template>
  <div class="dashboard page-container">
    <!-- System Info -->
    <div class="system-info-bar">
      <div class="info-item">
        <el-icon><Monitor /></el-icon>
        <span>{{ monitorStore.systemInfo?.hostname || '-' }}</span>
      </div>
      <div class="info-item">
        <el-icon><Cpu /></el-icon>
        <span>{{ monitorStore.systemInfo?.cpuModel || '-' }}</span>
      </div>
      <div class="info-item">
        <el-icon><Timer /></el-icon>
        <span>运行: {{ formatUptime(monitorStore.systemInfo?.uptime || 0) }}</span>
      </div>
      <div class="info-item">
        <el-icon><Calendar /></el-icon>
        <span>{{ currentTime }}</span>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(59, 130, 246, 0.15); color: var(--opmp-primary)">
          <el-icon :size="24"><Cpu /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ monitorStore.cpuUsage.toFixed(1) }}%</div>
          <div class="stat-label">CPU 使用率</div>
        </div>
        <el-progress
          :percentage="monitorStore.cpuUsage"
          :stroke-width="4"
          :show-text="false"
          :color="getProgressColor(monitorStore.cpuUsage)"
        />
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(34, 197, 94, 0.15); color: var(--opmp-success)">
          <el-icon :size="24"><Coin /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ monitorStore.memoryUsage.toFixed(1) }}%</div>
          <div class="stat-label">内存使用率</div>
        </div>
        <el-progress
          :percentage="monitorStore.memoryUsage"
          :stroke-width="4"
          :show-text="false"
          :color="getProgressColor(monitorStore.memoryUsage)"
        />
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(245, 158, 11, 0.15); color: var(--opmp-warning)">
          <el-icon :size="24"><Folder /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ monitorStore.diskUsage.toFixed(1) }}%</div>
          <div class="stat-label">磁盘使用率</div>
        </div>
        <el-progress
          :percentage="monitorStore.diskUsage"
          :stroke-width="4"
          :show-text="false"
          :color="getProgressColor(monitorStore.diskUsage)"
        />
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(6, 182, 212, 0.15); color: var(--opmp-info)">
          <el-icon :size="24"><Connection /></el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatSpeed(monitorStore.networkTraffic.rx + monitorStore.networkTraffic.tx) }}</div>
          <div class="stat-label">网络总流量</div>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <div class="chart-card">
        <h3>CPU 使用率</h3>
        <div ref="cpuChartRef" class="chart-container"></div>
      </div>
      <div class="chart-card">
        <h3>内存使用率</h3>
        <div ref="memChartRef" class="chart-container"></div>
      </div>
    </div>

    <!-- Bottom Row: Load Average & Docker Quick View -->
    <div class="bottom-row">
      <div class="chart-card">
        <h3>系统负载</h3>
        <div class="load-avg">
          <div class="load-item">
            <span class="load-label">1 min</span>
            <span class="load-value">{{ monitorStore.snapshot?.loadAvg?.[0]?.toFixed(2) || '-' }}</span>
          </div>
          <div class="load-item">
            <span class="load-label">5 min</span>
            <span class="load-value">{{ monitorStore.snapshot?.loadAvg?.[1]?.toFixed(2) || '-' }}</span>
          </div>
          <div class="load-item">
            <span class="load-label">15 min</span>
            <span class="load-value">{{ monitorStore.snapshot?.loadAvg?.[2]?.toFixed(2) || '-' }}</span>
          </div>
        </div>
      </div>
      <div class="chart-card">
        <h3>磁盘分区</h3>
        <el-table :data="monitorStore.snapshot?.disks || []" size="small" max-height="200">
          <el-table-column prop="mountPoint" label="挂载点" width="120" />
          <el-table-column prop="filesystem" label="文件系统" width="140" />
          <el-table-column label="使用率" width="150">
            <template #default="{ row }">
              <el-progress :percentage="row.usagePercent" :stroke-width="6" :show-text="true" :color="getProgressColor(row.usagePercent)" />
            </template>
          </el-table-column>
          <el-table-column label="总量">
            <template #default="{ row }">{{ formatBytes(row.total) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div class="chart-card">
        <h3>网络流量</h3>
        <el-table :data="monitorStore.snapshot?.network || []" size="small" max-height="200">
          <el-table-column prop="interfaceName" label="接口" width="100" />
          <el-table-column label="接收">
            <template #default="{ row }">{{ formatSpeed(row.rxBytesPerSec) }}/s</template>
          </el-table-column>
          <el-table-column label="发送">
            <template #default="{ row }">{{ formatSpeed(row.txBytesPerSec) }}/s</template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useMonitorStore } from '@/stores/monitor';
import * as echarts from 'echarts';

const monitorStore = useMonitorStore();
const cpuChartRef = ref<HTMLDivElement>();
const memChartRef = ref<HTMLDivElement>();
const currentTime = ref('');

let cpuChart: echarts.ECharts | null = null;
let memChart: echarts.ECharts | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}天 ${hours}时 ${mins}分`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec);
}

function getProgressColor(value: number): string {
  if (value < 60) return '#22c55e';
  if (value < 80) return '#f59e0b';
  return '#ef4444';
}

function initCharts() {
  if (cpuChartRef.value) {
    cpuChart = echarts.init(cpuChartRef.value, 'dark');
    cpuChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      xAxis: { type: 'category', data: [], axisLine: { lineStyle: { color: '#2a3544' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      yAxis: { type: 'value', max: 100, axisLine: { show: false }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      series: [{ type: 'line', data: [], smooth: true, showSymbol: false, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(59,130,246,0.3)' }, { offset: 1, color: 'rgba(59,130,246,0)' }]) }, lineStyle: { color: '#3b82f6', width: 2 } }],
    });
  }

  if (memChartRef.value) {
    memChart = echarts.init(memChartRef.value, 'dark');
    memChart.setOption({
      backgroundColor: 'transparent',
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      xAxis: { type: 'category', data: [], axisLine: { lineStyle: { color: '#2a3544' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      yAxis: { type: 'value', max: 100, axisLine: { show: false }, splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 10 } },
      series: [{ type: 'line', data: [], smooth: true, showSymbol: false, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(34,197,94,0.3)' }, { offset: 1, color: 'rgba(34,197,94,0)' }]) }, lineStyle: { color: '#22c55e', width: 2 } }],
    });
  }
}

function updateCharts() {
  const history = monitorStore.history;
  const last60 = history.slice(-60);

  const times = last60.map(s => new Date(s.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const cpuData = last60.map(s => s.cpu.usage.toFixed(1));
  const memData = last60.map(s => s.memory.usagePercent.toFixed(1));

  cpuChart?.setOption({ xAxis: { data: times }, series: [{ data: cpuData }] });
  memChart?.setOption({ xAxis: { data: times }, series: [{ data: memData }] });
}

watch(() => monitorStore.history.length, () => {
  updateCharts();
});

onMounted(async () => {
  initCharts();
  await monitorStore.fetchSnapshot();
  await monitorStore.fetchHistory();
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleString('zh-CN');
  }, 1000);
  currentTime.value = new Date().toLocaleString('zh-CN');
});

onUnmounted(() => {
  cpuChart?.dispose();
  memChart?.dispose();
  if (timer) clearInterval(timer);
});
</script>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.system-info-bar {
  display: flex;
  gap: 24px;
  padding: 12px 20px;
  background: var(--opmp-bg-card);
  border: 1px solid var(--opmp-border);
  border-radius: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--opmp-text-secondary);

  .el-icon {
    color: var(--opmp-primary);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.stat-content {
  .stat-value {
    font-size: 26px;
    font-weight: 700;
  }

  .stat-label {
    font-size: 13px;
    color: var(--opmp-text-secondary);
  }
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart-card {
  background: var(--opmp-bg-card);
  border: 1px solid var(--opmp-border);
  border-radius: 8px;
  padding: 16px;

  h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--opmp-text-secondary);
    margin-bottom: 12px;
  }
}

.chart-container {
  height: 200px;
}

.bottom-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.load-avg {
  display: flex;
  gap: 24px;
  justify-content: center;
  padding: 20px 0;
}

.load-item {
  text-align: center;
}

.load-label {
  display: block;
  font-size: 12px;
  color: var(--opmp-text-secondary);
  margin-bottom: 4px;
}

.load-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--opmp-primary);
}
</style>
