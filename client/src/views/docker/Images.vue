<template>
  <div class="images-page page-container">
    <div class="page-header">
      <h2>镜像管理</h2>
      <div class="header-actions">
        <el-input v-model="filter" placeholder="搜索镜像..." style="width: 200px" size="small" clearable />
        <el-button size="small" @click="loadImages">刷新</el-button>
        <el-button type="primary" size="small" @click="showPullDialog = true">拉取镜像</el-button>
        <el-button type="warning" size="small" @click="pruneImages">清理未使用</el-button>
      </div>
    </div>

    <el-table :data="filteredImages" v-loading="loading" size="small">
      <el-table-column label="镜像" min-width="300">
        <template #default="{ row }">
          <div v-for="tag in row.repoTags" :key="tag">{{ tag }}</div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="120">
        <template #default="{ row }">{{ formatBytes(row.size) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ new Date(row.created).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column prop="architecture" label="架构" width="100" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" @click="inspectImage(row)">详情</el-button>
          <el-button text size="small" type="danger" @click="removeImage(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showPullDialog" title="拉取镜像" width="500px">
      <el-input v-model="pullImageName" placeholder="镜像名:标签 如 nginx:latest" />
      <template #footer>
        <el-button @click="showPullDialog = false">取消</el-button>
        <el-button type="primary" :loading="pulling" @click="pullImage">拉取</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showInspectDialog" title="镜像详情" width="600px">
      <pre class="inspect-content">{{ JSON.stringify(inspectData, null, 2) }}</pre>
      <template #footer>
        <el-button @click="showInspectDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { dockerApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const dockerStore = useDockerStore();
const loading = ref(false);
const filter = ref('');
const showPullDialog = ref(false);
const showInspectDialog = ref(false);
const pullImageName = ref('');
const pulling = ref(false);
const inspectData = ref<any>({});

const filteredImages = computed(() => {
  if (!filter.value) return dockerStore.images;
  const q = filter.value.toLowerCase();
  return dockerStore.images.filter(i => i.repoTags?.some((t: string) => t.toLowerCase().includes(q)));
});

async function loadImages() {
  loading.value = true;
  try { await dockerStore.fetchImages(); }
  finally { loading.value = false; }
}

async function pullImage() {
  if (!pullImageName.value) { ElMessage.warning('请输入镜像名'); return; }
  pulling.value = true;
  try {
    await dockerStore.pullImage(pullImageName.value);
    ElMessage.success('镜像拉取成功');
    showPullDialog.value = false;
    pullImageName.value = '';
  } catch (e: any) { ElMessage.error(e.error || '拉取失败'); }
  finally { pulling.value = false; }
}

async function removeImage(image: any) {
  try {
    await ElMessageBox.confirm(`确定删除镜像 ${image.repoTags?.[0] || image.id}?`, '确认', { type: 'warning' });
    await dockerStore.removeImage(image.id);
    ElMessage.success('镜像已删除');
  } catch {}
}

async function inspectImage(image: any) {
  try {
    const res: any = await dockerApi.getImage(image.id);
    inspectData.value = res;
    showInspectDialog.value = true;
  } catch (e: any) { ElMessage.error(e.error || '获取详情失败'); }
}

async function pruneImages() {
  try {
    await ElMessageBox.confirm('确定清理所有未使用的镜像?', '确认', { type: 'warning' });
    await dockerApi.prune(true, false);
    ElMessage.success('清理完成');
    loadImages();
  } catch {}
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

onMounted(loadImages);
</script>

<style scoped lang="scss">
.images-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; }
.inspect-content { font-family: 'Fira Code', monospace; font-size: 12px; line-height: 1.4; white-space: pre-wrap; background: var(--opmp-bg); padding: 12px; border-radius: 6px; max-height: 60vh; overflow: auto; }
</style>
