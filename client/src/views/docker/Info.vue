<template>
  <div class="docker-info-page page-container">
    <div class="page-header">
      <h2>Docker 信息</h2>
      <el-button size="small" @click="loadInfo">刷新</el-button>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>系统信息</h3>
        <div class="info-row"><span>服务器版本</span><span>{{ info?.serverVersion || '-' }}</span></div>
        <div class="info-row"><span>操作系统</span><span>{{ info?.operatingSystem || '-' }}</span></div>
        <div class="info-row"><span>架构</span><span>{{ info?.architecture || '-' }}</span></div>
        <div class="info-row"><span>内核版本</span><span>{{ info?.kernelVersion || '-' }}</span></div>
        <div class="info-row"><span>CPU核心</span><span>{{ info?.cpuCores || '-' }}</span></div>
        <div class="info-row"><span>总内存</span><span>{{ formatBytes(info?.memoryTotal || 0) }}</span></div>
      </div>

      <div class="info-card">
        <h3>存储</h3>
        <div class="info-row"><span>存储驱动</span><span>{{ info?.storageDriver || '-' }}</span></div>
        <div class="info-row"><span>数据目录</span><span>{{ info?.dockerRootDir || '-' }}</span></div>
      </div>

      <div class="info-card">
        <h3>容器统计</h3>
        <div class="info-row"><span>总容器</span><span>{{ info?.containers || 0 }}</span></div>
        <div class="info-row"><span>运行中</span><span style="color: var(--opmp-success)">{{ info?.containersRunning || 0 }}</span></div>
        <div class="info-row"><span>已停止</span><span>{{ info?.containersStopped || 0 }}</span></div>
        <div class="info-row"><span>镜像数</span><span>{{ info?.images || 0 }}</span></div>
      </div>
    </div>

    <div class="disk-usage" v-loading="loading">
      <h3>磁盘使用</h3>
      <el-table :data="diskUsageData" size="small">
        <el-table-column prop="type" label="类型" width="120" />
        <el-table-column prop="count" label="数量" width="100" />
        <el-table-column label="占用空间" width="150">
          <template #default="{ row }">{{ formatBytes(row.size) }}</template>
        </el-table-column>
        <el-table-column label="可回收" width="150">
          <template #default="{ row }">{{ formatBytes(row.reclaimable) }}</template>
        </el-table-column>
      </el-table>
      <el-button type="warning" size="small" style="margin-top: 12px" @click="pruneSystem">清理系统</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { dockerApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const dockerStore = useDockerStore();
const loading = ref(false);
const info = ref<any>(null);
const diskUsage = ref<any>(null);

const diskUsageData = computed(() => [
  { type: '镜像', count: diskUsage.value?.images?.count || 0, size: diskUsage.value?.images?.size || 0, reclaimable: diskUsage.value?.images?.reclaimable || 0 },
  { type: '容器', count: diskUsage.value?.containers?.count || 0, size: diskUsage.value?.containers?.size || 0, reclaimable: diskUsage.value?.containers?.reclaimable || 0 },
  { type: '卷', count: diskUsage.value?.volumes?.count || 0, size: diskUsage.value?.volumes?.size || 0, reclaimable: diskUsage.value?.volumes?.reclaimable || 0 },
  { type: '构建缓存', count: diskUsage.value?.buildCache?.count || 0, size: diskUsage.value?.buildCache?.size || 0, reclaimable: diskUsage.value?.buildCache?.reclaimable || 0 },
]);

async function loadInfo() {
  loading.value = true;
  try {
    await dockerStore.fetchInfo();
    info.value = dockerStore.info;
    const res: any = await dockerApi.getDiskUsage();
    diskUsage.value = res;
  } finally { loading.value = false; }
}

async function pruneSystem() {
  try {
    await ElMessageBox.confirm('确定清理所有未使用的Docker资源?', '确认清理', { type: 'warning' });
    await dockerApi.prune(true, true);
    ElMessage.success('清理完成');
    loadInfo();
  } catch {}
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

onMounted(loadInfo);
</script>

<style scoped lang="scss">
.docker-info-page { display: flex; flex-direction: column; gap: 16px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.info-card {
  background: var(--opmp-bg-card);
  border: 1px solid var(--opmp-border);
  border-radius: 8px;
  padding: 16px;
  h3 { font-size: 14px; color: var(--opmp-text-secondary); margin-bottom: 12px; }
}
.info-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--opmp-border); &:last-child { border-bottom: none; } }
.disk-usage { background: var(--opmp-bg-card); border: 1px solid var(--opmp-border); border-radius: 8px; padding: 16px; h3 { margin-bottom: 12px; } }
</style>
