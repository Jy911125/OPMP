<template>
  <div class="networks-page page-container">
    <div class="page-header">
      <h2>网络管理</h2>
      <div class="header-actions">
        <el-button size="small" @click="loadNetworks">刷新</el-button>
        <el-button type="primary" size="small" @click="showCreateDialog = true">创建网络</el-button>
      </div>
    </div>

    <el-table :data="dockerStore.networks" v-loading="loading" size="small">
      <el-table-column prop="name" label="网络名" width="200" />
      <el-table-column prop="driver" label="驱动" width="100" />
      <el-table-column prop="subnet" label="子网" width="150" />
      <el-table-column prop="gateway" label="网关" width="150" />
      <el-table-column label="连接容器" min-width="200">
        <template #default="{ row }">
          <span v-for="(c, id) in row.containers" :key="id" style="margin-right: 8px">{{ c.name }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.name !== 'bridge' && row.name !== 'host' && row.name !== 'none'"
            text size="small" type="danger" @click="removeNetwork(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="创建网络" width="400px">
      <el-form :model="newNetwork" label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="newNetwork.name" placeholder="网络名称" />
        </el-form-item>
        <el-form-item label="驱动">
          <el-select v-model="newNetwork.driver">
            <el-option value="bridge" label="bridge" />
            <el-option value="overlay" label="overlay" />
            <el-option value="macvlan" label="macvlan" />
          </el-select>
        </el-form-item>
        <el-form-item label="子网">
          <el-input v-model="newNetwork.subnet" placeholder="如: 172.20.0.0/16" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createNetwork">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { ElMessage, ElMessageBox } from 'element-plus';

const dockerStore = useDockerStore();
const loading = ref(false);
const showCreateDialog = ref(false);
const newNetwork = reactive({ name: '', driver: 'bridge', subnet: '' });

async function loadNetworks() {
  loading.value = true;
  try { await dockerStore.fetchNetworks(); }
  finally { loading.value = false; }
}

async function createNetwork() {
  if (!newNetwork.name) { ElMessage.warning('请输入网络名称'); return; }
  try {
    await dockerStore.createNetwork(newNetwork.name, newNetwork.driver);
    ElMessage.success('网络创建成功');
    showCreateDialog.value = false;
    Object.assign(newNetwork, { name: '', driver: 'bridge', subnet: '' });
  } catch (e: any) { ElMessage.error(e.error || '创建失败'); }
}

async function removeNetwork(net: any) {
  try {
    await ElMessageBox.confirm(`确定删除网络 ${net.name}?`, '确认', { type: 'warning' });
    await dockerStore.removeNetwork(net.id);
    ElMessage.success('网络已删除');
  } catch {}
}

onMounted(loadNetworks);
</script>

<style scoped lang="scss">
.networks-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; }
</style>
