<template>
  <div class="packages-page page-container">
    <div class="page-header">
      <h2>软件包管理</h2>
      <div class="header-actions">
        <el-input v-model="filter" placeholder="搜索软件包..." style="width: 250px" size="small" clearable />
        <el-button size="small" @click="loadPackages">刷新</el-button>
        <el-button type="primary" size="small" @click="updatePkgList">更新列表</el-button>
        <el-button type="warning" size="small" @click="upgradePkg">升级</el-button>
      </div>
    </div>

    <el-table :data="filteredPackages" v-loading="loading" size="small" max-height="calc(100vh - 180px)">
      <el-table-column prop="name" label="包名" width="200" sortable />
      <el-table-column prop="version" label="版本" width="200" />
      <el-table-column prop="architecture" label="架构" width="80" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ii' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="300" show-overflow-tooltip />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" type="danger" @click="removePkg(row.name)">卸载</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showInstallDialog" title="安装软件包" width="400px">
      <el-input v-model="installPkgName" placeholder="软件包名称" />
      <template #footer>
        <el-button @click="showInstallDialog = false">取消</el-button>
        <el-button type="primary" @click="installPkg">安装</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { packagesApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const packages = ref<any[]>([]);
const loading = ref(false);
const filter = ref('');
const showInstallDialog = ref(false);
const installPkgName = ref('');

const filteredPackages = computed(() => {
  if (!filter.value) return packages.value;
  const q = filter.value.toLowerCase();
  return packages.value.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
});

async function loadPackages() {
  loading.value = true;
  try {
    const res: any = await packagesApi.list();
    packages.value = res;
  } finally { loading.value = false; }
}

async function installPkg() {
  if (!installPkgName.value) return;
  try {
    await packagesApi.install(installPkgName.value);
    ElMessage.success('安装成功');
    showInstallDialog.value = false;
    installPkgName.value = '';
    loadPackages();
  } catch (error: any) { ElMessage.error(error.error || '安装失败'); }
}

async function removePkg(name: string) {
  try {
    await ElMessageBox.confirm(`确定卸载 ${name}?`, '确认', { type: 'warning' });
    await packagesApi.remove(name);
    ElMessage.success('卸载成功');
    loadPackages();
  } catch {}
}

async function updatePkgList() {
  try {
    await packagesApi.update();
    ElMessage.success('软件列表已更新');
    loadPackages();
  } catch (error: any) { ElMessage.error(error.error || '更新失败'); }
}

async function upgradePkg() {
  try {
    await ElMessageBox.confirm('确定升级所有软件包? 这可能需要较长时间。', '确认升级', { type: 'warning' });
    await packagesApi.upgrade();
    ElMessage.success('升级完成');
    loadPackages();
  } catch {}
}

onMounted(loadPackages);
</script>

<style scoped lang="scss">
.packages-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; }
</style>
