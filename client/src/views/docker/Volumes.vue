<template>
  <div class="volumes-page page-container">
    <div class="page-header">
      <h2>卷管理</h2>
      <div class="header-actions">
        <el-button size="small" @click="loadVolumes">刷新</el-button>
        <el-button type="primary" size="small" @click="showCreateDialog = true">创建卷</el-button>
        <el-button type="warning" size="small" @click="pruneVolumes">清理未使用</el-button>
      </div>
    </div>

    <el-table :data="dockerStore.volumes" v-loading="loading" size="small">
      <el-table-column prop="name" label="卷名" min-width="250" />
      <el-table-column prop="driver" label="驱动" width="100" />
      <el-table-column prop="mountPoint" label="挂载点" min-width="300" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" type="danger" @click="removeVolume(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="创建卷" width="400px">
      <el-form label-width="80px">
        <el-form-item label="卷名">
          <el-input v-model="newVolumeName" placeholder="卷名称" />
        </el-form-item>
        <el-form-item label="驱动">
          <el-select v-model="newVolumeDriver">
            <el-option value="local" label="local" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createVolume">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { ElMessage, ElMessageBox } from 'element-plus';

const dockerStore = useDockerStore();
const loading = ref(false);
const showCreateDialog = ref(false);
const newVolumeName = ref('');
const newVolumeDriver = ref('local');

async function loadVolumes() {
  loading.value = true;
  try { await dockerStore.fetchVolumes(); }
  finally { loading.value = false; }
}

async function createVolume() {
  if (!newVolumeName.value) { ElMessage.warning('请输入卷名'); return; }
  try {
    await dockerStore.createVolume(newVolumeName.value, newVolumeDriver.value);
    ElMessage.success('卷创建成功');
    showCreateDialog.value = false;
    newVolumeName.value = '';
  } catch (e: any) { ElMessage.error(e.error || '创建失败'); }
}

async function removeVolume(vol: any) {
  try {
    await ElMessageBox.confirm(`确定删除卷 ${vol.name}?`, '确认', { type: 'warning' });
    await dockerStore.removeVolume(vol.name);
    ElMessage.success('卷已删除');
  } catch {}
}

async function pruneVolumes() {
  try {
    await ElMessageBox.confirm('确定清理所有未使用的卷?', '确认', { type: 'warning' });
    await dockerStore.removeVolume(''); // prune via API
    ElMessage.success('清理完成');
    loadVolumes();
  } catch {}
}

onMounted(loadVolumes);
</script>

<style scoped lang="scss">
.volumes-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; }
</style>
