<template>
  <div class="filesystem-page page-container">
    <div class="page-header">
      <h2>文件管理</h2>
      <div class="header-actions">
        <el-input v-model="searchPattern" placeholder="搜索文件..." style="width: 200px" size="small" clearable @keyup.enter="searchFiles">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button size="small" type="primary" @click="showUploadDialog = true">上传文件</el-button>
        <el-button size="small" @click="showMkdirDialog = true">新建文件夹</el-button>
      </div>
    </div>

    <!-- Breadcrumb -->
    <div class="breadcrumb-bar">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-for="(part, idx) in pathParts" :key="idx" @click="navigateTo(idx)">
          <span class="breadcrumb-link">{{ part || '/' }}</span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- File list -->
    <el-table :data="files" v-loading="loading" size="small" @row-dblclick="handleDblClick" @sort-change="handleSort">
      <el-table-column label="名称" prop="name" sortable min-width="300">
        <template #default="{ row }">
          <div class="file-name" @click="handleClick(row)">
            <el-icon :size="18" :color="getFileIcon(row).color"><component :is="getFileIcon(row).icon" /></el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="120" sortable prop="size">
        <template #default="{ row }">{{ row.type === 'directory' ? '-' : formatBytes(row.size) }}</template>
      </el-table-column>
      <el-table-column label="权限" width="100" prop="permissions" />
      <el-table-column label="所有者" width="100" prop="owner" />
      <el-table-column label="组" width="100" prop="group" />
      <el-table-column label="修改时间" width="180" sortable prop="modified">
        <template #default="{ row }">{{ new Date(row.modified).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.type === 'file'" text size="small" @click="editFile(row)">编辑</el-button>
          <el-button text size="small" @click="chmodFile(row)">权限</el-button>
          <el-button text size="small" type="danger" @click="deleteFile(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- File Editor Dialog -->
    <el-dialog v-model="showEditor" :title="`编辑: ${editingFile?.name || ''}`" width="80%" top="5vh" destroy-on-close>
      <div class="editor-container">
        <el-input v-model="fileContent" type="textarea" :rows="30" resize="none" spellcheck="false" />
      </div>
      <template #footer>
        <el-button @click="showEditor = false">取消</el-button>
        <el-button type="primary" @click="saveFile">保存</el-button>
      </template>
    </el-dialog>

    <!-- Mkdir Dialog -->
    <el-dialog v-model="showMkdirDialog" title="新建文件夹" width="400px">
      <el-input v-model="newDirName" placeholder="文件夹名称" />
      <template #footer>
        <el-button @click="showMkdirDialog = false">取消</el-button>
        <el-button type="primary" @click="createDir">创建</el-button>
      </template>
    </el-dialog>

    <!-- Upload Dialog -->
    <el-dialog v-model="showUploadDialog" title="上传文件" width="500px">
      <el-upload drag :auto-upload="false" :on-change="handleUploadChange">
        <el-icon :size="40"><Upload /></el-icon>
        <div>拖拽文件或点击上传</div>
      </el-upload>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="uploadFile">上传</el-button>
      </template>
    </el-dialog>

    <!-- Chmod Dialog -->
    <el-dialog v-model="showChmodDialog" title="修改权限" width="400px">
      <el-form label-width="80px">
        <el-form-item label="文件">
          <el-input :model-value="chmodTarget?.name" disabled />
        </el-form-item>
        <el-form-item label="权限值">
          <el-input v-model="chmodMode" placeholder="如: 755, 644" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChmodDialog = false">取消</el-button>
        <el-button type="primary" @click="applyChmod">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { filesApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const currentPath = ref('/');
const files = ref<any[]>([]);
const loading = ref(false);
const searchPattern = ref('');

const showEditor = ref(false);
const showMkdirDialog = ref(false);
const showUploadDialog = ref(false);
const showChmodDialog = ref(false);
const editingFile = ref<any>(null);
const fileContent = ref('');
const newDirName = ref('');
const chmodTarget = ref<any>(null);
const chmodMode = ref('');
const uploadFile = ref<File | null>(null);
const uploadFileName = ref('');

const pathParts = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean);
  return ['', ...parts];
});

async function loadFiles() {
  loading.value = true;
  try {
    const res: any = await filesApi.list(currentPath.value);
    files.value = res;
  } finally {
    loading.value = false;
  }
}

function navigateTo(idx: number) {
  const parts = currentPath.value.split('/').filter(Boolean);
  currentPath.value = '/' + parts.slice(0, idx).join('/');
  loadFiles();
}

function handleClick(file: any) {
  if (file.type === 'directory') {
    currentPath.value = file.path;
    loadFiles();
  }
}

function handleDblClick(file: any) {
  if (file.type === 'directory') {
    currentPath.value = file.path;
    loadFiles();
  } else {
    editFile(file);
  }
}

async function editFile(file: any) {
  try {
    const res: any = await filesApi.getContent(file.path);
    editingFile.value = file;
    fileContent.value = res.content;
    showEditor.value = true;
  } catch (error: any) {
    ElMessage.error(error.error || '读取文件失败');
  }
}

async function saveFile() {
  try {
    await filesApi.writeFile(editingFile.value.path, fileContent.value);
    ElMessage.success('保存成功');
    showEditor.value = false;
  } catch (error: any) {
    ElMessage.error(error.error || '保存失败');
  }
}

async function createDir() {
  try {
    const path = currentPath.value === '/' ? `/${newDirName.value}` : `${currentPath.value}/${newDirName.value}`;
    await filesApi.mkdir(path);
    ElMessage.success('创建成功');
    showMkdirDialog.value = false;
    newDirName.value = '';
    loadFiles();
  } catch (error: any) {
    ElMessage.error(error.error || '创建失败');
  }
}

async function deleteFile(file: any) {
  try {
    await ElMessageBox.confirm(`确定删除 ${file.name}?`, '确认删除', { type: 'warning' });
    await filesApi.delete(file.path, file.type === 'directory');
    ElMessage.success('删除成功');
    loadFiles();
  } catch {}
}

function chmodFile(file: any) {
  chmodTarget.value = file;
  chmodMode.value = file.permissions;
  showChmodDialog.value = true;
}

async function applyChmod() {
  try {
    await filesApi.chmod(chmodTarget.value.path, chmodMode.value);
    ElMessage.success('权限已修改');
    showChmodDialog.value = false;
    loadFiles();
  } catch (error: any) {
    ElMessage.error(error.error || '修改权限失败');
  }
}

async function searchFiles() {
  if (!searchPattern.value) { loadFiles(); return; }
  try {
    const res: any = await filesApi.search(searchPattern.value, currentPath.value);
    files.value = res;
  } catch (error: any) {
    ElMessage.error(error.error || '搜索失败');
  }
}

function handleUploadChange(file: any) {
  uploadFile.value = file.raw;
  uploadFileName.value = file.name;
}

function handleSort() {}

function getFileIcon(file: any) {
  if (file.type === 'directory') return { icon: 'Folder', color: '#f59e0b' };
  if (file.name?.endsWith('.py')) return { icon: 'Document', color: '#3b82f6' };
  if (file.name?.endsWith('.js') || file.name?.endsWith('.ts')) return { icon: 'Document', color: '#22c55e' };
  if (file.name?.endsWith('.md')) return { icon: 'Document', color: '#8b5cf6' };
  return { icon: 'Document', color: '#94a3b8' };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

onMounted(loadFiles);
</script>

<style scoped lang="scss">
.filesystem-page { display: flex; flex-direction: column; gap: 12px; }

.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.header-actions { display: flex; gap: 8px; align-items: center; }

.breadcrumb-bar {
  padding: 8px 12px;
  background: var(--opmp-bg-card);
  border: 1px solid var(--opmp-border);
  border-radius: 6px;
}

.breadcrumb-link { cursor: pointer; &:hover { color: var(--opmp-primary); } }

.file-name {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  &:hover { color: var(--opmp-primary); }
}

.editor-container { :deep(textarea) { font-family: 'Fira Code', 'Consolas', monospace; font-size: 14px; line-height: 1.6; } }
</style>
