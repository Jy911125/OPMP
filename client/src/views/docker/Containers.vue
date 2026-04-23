<template>
  <div class="containers-page page-container">
    <div class="page-header">
      <h2>容器管理</h2>
      <div class="header-actions">
        <el-input v-model="filter" placeholder="搜索容器..." style="width: 200px" size="small" clearable />
        <el-checkbox v-model="showAll" @change="loadContainers">显示停止的</el-checkbox>
        <el-button size="small" @click="loadContainers">刷新</el-button>
        <el-button type="primary" size="small" @click="showCreateDialog = true">创建容器</el-button>
      </div>
    </div>

    <el-table :data="filteredContainers" v-loading="loading" size="small" max-height="calc(100vh - 180px)">
      <el-table-column label="容器名" width="200">
        <template #default="{ row }">
          <div class="container-name" @click="showContainerDetails(row)">
            {{ row.name }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="image" label="镜像" width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="getStateType(row.state)" size="small">{{ row.state }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="端口" min-width="200">
        <template #default="{ row }">
          <span v-for="p in row.ports" :key="p.privatePort" style="margin-right: 8px">
            {{ p.publicPort }}:{{ p.privatePort }}/{{ p.type }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="网络" width="150">
        <template #default="{ row }">
          <el-tag v-for="n in row.networks" :key="n" size="small" style="margin: 2px">{{ n }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.state !== 'running'" text size="small" type="success" @click="startContainer(row.id)">启动</el-button>
          <el-button v-if="row.state === 'running'" text size="small" type="warning" @click="stopContainer(row.id)">停止</el-button>
          <el-button v-if="row.state === 'running'" text size="small" type="primary" @click="restartContainer(row.id)">重启</el-button>
          <el-button text size="small" @click="viewLogs(row)">日志</el-button>
          <el-button text size="small" type="danger" @click="removeContainer(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="创建容器" width="600px">
      <el-form :model="newContainer" label-width="80px">
        <el-form-item label="镜像" required>
          <el-input v-model="newContainer.image" placeholder="如: nginx:latest" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="newContainer.name" placeholder="容器名称" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input v-model="newContainer.ports" placeholder="如: 8080:80, 443:443" />
        </el-form-item>
        <el-form-item label="环境变量">
          <el-input v-model="newContainer.env" type="textarea" :rows="3" placeholder="KEY=value 每行一个" />
        </el-form-item>
        <el-form-item label="重启策略">
          <el-select v-model="newContainer.restart">
            <el-option value="no" label="不重启" />
            <el-option value="always" label="总是重启" />
            <el-option value="unless-stopped" label="除非手动停止" />
            <el-option value="on-failure" label="失败时重启" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createContainer">创建并启动</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showLogsDialog" :title="`日志: ${selectedContainer?.name || ''}`" width="80%" top="5vh">
      <div class="log-container">
        <pre class="log-content">{{ containerLogs }}</pre>
      </div>
      <template #footer>
        <el-button @click="showLogsDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { dockerApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const dockerStore = useDockerStore();
const loading = ref(false);
const filter = ref('');
const showAll = ref(false);
const showCreateDialog = ref(false);
const showLogsDialog = ref(false);
const selectedContainer = ref<any>(null);
const containerLogs = ref('');
const newContainer = reactive({ image: '', name: '', ports: '', env: '', restart: 'no' });

const filteredContainers = computed(() => {
  if (!filter.value) return dockerStore.containers;
  const q = filter.value.toLowerCase();
  return dockerStore.containers.filter(c => c.name?.toLowerCase().includes(q) || c.image?.toLowerCase().includes(q));
});

async function loadContainers() {
  loading.value = true;
  try { await dockerStore.fetchContainers(showAll.value); }
  finally { loading.value = false; }
}

async function startContainer(id: string) {
  try { await dockerStore.startContainer(id); ElMessage.success('容器已启动'); }
  catch (e: any) { ElMessage.error(e.error || '启动失败'); }
}

async function stopContainer(id: string) {
  try { await dockerStore.stopContainer(id); ElMessage.success('容器已停止'); }
  catch (e: any) { ElMessage.error(e.error || '停止失败'); }
}

async function restartContainer(id: string) {
  try { await dockerStore.restartContainer(id); ElMessage.success('容器已重启'); }
  catch (e: any) { ElMessage.error(e.error || '重启失败'); }
}

async function removeContainer(id: string) {
  try {
    await ElMessageBox.confirm('确定删除此容器?', '确认', { type: 'warning' });
    await dockerStore.removeContainer(id);
    ElMessage.success('容器已删除');
  } catch {}
}

async function createContainer() {
  if (!newContainer.image) { ElMessage.warning('请输入镜像'); return; }
  try {
    const opts: any = { image: newContainer.image, name: newContainer.name, restartPolicy: newContainer.restart };
    if (newContainer.ports) {
      opts.ports = {};
      for (const p of newContainer.ports.split(',')) {
        const [host, container] = p.trim().split(':');
        opts.ports[`${container}/tcp`] = { HostPort: host };
      }
    }
    if (newContainer.env) opts.env = newContainer.env.split('\n').filter(Boolean);
    const res: any = await dockerApi.createContainer(opts);
    await dockerApi.containerAction(res.id, 'start');
    ElMessage.success('容器创建并启动成功');
    showCreateDialog.value = false;
    Object.assign(newContainer, { image: '', name: '', ports: '', env: '', restart: 'no' });
    loadContainers();
  } catch (e: any) { ElMessage.error(e.error || '创建失败'); }
}

async function viewLogs(container: any) {
  selectedContainer.value = container;
  showLogsDialog.value = true;
  try {
    const res: any = await dockerApi.getContainerLogs(container.id, 500);
    containerLogs.value = res.logs || '暂无日志';
  } catch { containerLogs.value = '获取日志失败'; }
}

function showContainerDetails(container: any) {
  viewLogs(container);
}

function getStateType(state: string): string {
  if (state === 'running') return 'success';
  if (state === 'paused') return 'warning';
  return 'info';
}

onMounted(loadContainers);
</script>

<style scoped lang="scss">
.containers-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; align-items: center; }
.container-name { cursor: pointer; &:hover { color: var(--opmp-primary); } }
.log-container { background: var(--opmp-bg); border-radius: 8px; padding: 12px; height: 60vh; overflow: auto; }
.log-content { font-family: 'Fira Code', monospace; font-size: 12px; line-height: 1.4; white-space: pre-wrap; word-break: break-all; margin: 0; }
</style>
