<template>
  <div class="services-page page-container">
    <div class="page-header">
      <h2>服务管理</h2>
      <el-input v-model="filter" placeholder="搜索服务..." style="width: 250px" size="small" clearable />
    </div>

    <el-table :data="filteredServices" v-loading="loading" size="small" max-height="calc(100vh - 180px)">
      <el-table-column prop="name" label="服务名" min-width="250" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.activeState === 'active' ? 'success' : row.activeState === 'failed' ? 'danger' : 'info'" size="small">
            {{ row.activeState }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="subState" label="子状态" width="120" />
      <el-table-column prop="description" label="描述" min-width="250" show-overflow-tooltip />
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" type="success" @click="doAction(row.name, 'start')">启动</el-button>
          <el-button text size="small" type="warning" @click="doAction(row.name, 'stop')">停止</el-button>
          <el-button text size="small" type="primary" @click="doAction(row.name, 'restart')">重启</el-button>
          <el-button v-if="row.unitFileState !== 'enabled'" text size="small" @click="doAction(row.name, 'enable')">启用</el-button>
          <el-button v-else text size="small" type="danger" @click="doAction(row.name, 'disable')">禁用</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { servicesApi } from '@/api';
import { ElMessage } from 'element-plus';

const services = ref<any[]>([]);
const loading = ref(false);
const filter = ref('');

const filteredServices = computed(() => {
  if (!filter.value) return services.value;
  const q = filter.value.toLowerCase();
  return services.value.filter(s => s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
});

async function loadServices() {
  loading.value = true;
  try {
    const res: any = await servicesApi.list('service');
    services.value = res;
  } finally { loading.value = false; }
}

async function doAction(name: string, action: 'start' | 'stop' | 'restart' | 'enable' | 'disable') {
  try {
    await servicesApi.action(name, action);
    ElMessage.success(`${name} ${action} 操作成功`);
    loadServices();
  } catch (error: any) { ElMessage.error(error.error || '操作失败'); }
}

onMounted(loadServices);
</script>

<style scoped lang="scss">
.services-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
</style>
