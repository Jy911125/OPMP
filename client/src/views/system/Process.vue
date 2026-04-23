<template>
  <div class="process-page page-container">
    <div class="page-header">
      <h2>进程管理</h2>
      <div class="header-actions">
        <el-input v-model="filter" placeholder="搜索进程..." style="width: 250px" size="small" clearable>
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" @click="loadProcesses">刷新</el-button>
      </div>
    </div>

    <el-table :data="filteredProcesses" v-loading="loading" size="small" max-height="calc(100vh - 180px)">
      <el-table-column prop="pid" label="PID" width="80" sortable />
      <el-table-column prop="user" label="用户" width="100" />
      <el-table-column prop="name" label="进程名" min-width="200" show-overflow-tooltip />
      <el-table-column label="CPU%" width="100" sortable prop="cpuPercent">
        <template #default="{ row }">
          <span :class="{'text-danger': row.cpuPercent > 80}">{{ row.cpuPercent?.toFixed(1) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="MEM%" width="100" sortable prop="memPercent">
        <template #default="{ row }">
          <span :class="{'text-danger': row.memPercent > 80}">{{ row.memPercent?.toFixed(1) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="内存" width="100">
        <template #default="{ row }">{{ formatBytes(row.memRSS) }}</template>
      </el-table-column>
      <el-table-column prop="state" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="getStateType(row.state)" size="small">{{ row.state }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" type="warning" @click="killProcess(row, 'SIGTERM')">终止</el-button>
          <el-button text size="small" type="danger" @click="killProcess(row, 'SIGKILL')">强杀</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { processApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const processes = ref<any[]>([]);
const loading = ref(false);
const filter = ref('');
let timer: NodeJS.Timeout | null = null;

const filteredProcesses = computed(() => {
  if (!filter.value) return processes.value;
  const q = filter.value.toLowerCase();
  return processes.value.filter(p =>
    p.name?.toLowerCase().includes(q) ||
    p.cmd?.toLowerCase().includes(q) ||
    String(p.pid).includes(q) ||
    p.user?.toLowerCase().includes(q)
  );
});

async function loadProcesses() {
  loading.value = true;
  try {
    const res: any = await processApi.list();
    processes.value = res;
  } finally {
    loading.value = false;
  }
}

async function killProcess(proc: any, signal: 'SIGTERM' | 'SIGKILL') {
  try {
    await ElMessageBox.confirm(`确定${signal === 'SIGKILL' ? '强制终止' : '终止'}进程 ${proc.name} (PID: ${proc.pid})?`, '确认操作', { type: 'warning' });
    await processApi.kill(proc.pid, signal);
    ElMessage.success('操作成功');
    loadProcesses();
  } catch {}
}

function getStateType(state: string): string {
  if (state === 'S' || state === 'R') return 'success';
  if (state === 'Z') return 'danger';
  return 'info';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

onMounted(() => {
  loadProcesses();
  timer = setInterval(loadProcesses, 10000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped lang="scss">
.process-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; }
.text-danger { color: var(--opmp-danger); font-weight: 600; }
</style>
