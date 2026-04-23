<template>
  <div class="users-page page-container">
    <div class="page-header">
      <h2>用户管理</h2>
      <el-button type="primary" size="small" @click="showCreateDialog = true">新建用户</el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="用户列表" name="users">
        <el-table :data="users" v-loading="loading" size="small" max-height="calc(100vh - 240px)">
          <el-table-column prop="username" label="用户名" width="150" />
          <el-table-column prop="uid" label="UID" width="80" />
          <el-table-column prop="gid" label="GID" width="80" />
          <el-table-column prop="home" label="家目录" min-width="200" />
          <el-table-column prop="shell" label="Shell" width="150" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.isSystem ? 'info' : 'success'" size="small">{{ row.isSystem ? '系统' : '普通' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button v-if="!row.isSystem && row.uid !== 0" text size="small" type="danger" @click="deleteUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="用户组" name="groups">
        <el-table :data="groups" v-loading="loading" size="small" max-height="calc(100vh - 240px)">
          <el-table-column prop="name" label="组名" width="200" />
          <el-table-column prop="gid" label="GID" width="100" />
          <el-table-column label="成员" min-width="300">
            <template #default="{ row }">
              <el-tag v-for="m in (row.members || []).slice(0, 5)" :key="m" size="small" style="margin: 2px">{{ m }}</el-tag>
              <span v-if="row.members?.length > 5" style="color: var(--opmp-text-secondary)">+{{ row.members.length - 5 }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showCreateDialog" title="新建用户" width="500px">
      <el-form :model="newUser" label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="newUser.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="家目录">
          <el-input v-model="newUser.home" placeholder="/home/username" />
        </el-form-item>
        <el-form-item label="Shell">
          <el-select v-model="newUser.shell">
            <el-option value="/bin/bash" label="/bin/bash" />
            <el-option value="/bin/zsh" label="/bin/zsh" />
            <el-option value="/bin/sh" label="/bin/sh" />
            <el-option value="/usr/sbin/nologin" label="/usr/sbin/nologin" />
          </el-select>
        </el-form-item>
        <el-form-item label="附加组">
          <el-input v-model="newUser.groups" placeholder="如: sudo,docker" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createUser">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { usersApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const users = ref<any[]>([]);
const groups = ref<any[]>([]);
const loading = ref(false);
const activeTab = ref('users');
const showCreateDialog = ref(false);
const newUser = reactive({ username: '', home: '', shell: '/bin/bash', groups: '' });

async function loadUsers() {
  loading.value = true;
  try {
    const res: any = await usersApi.list();
    users.value = res;
  } finally { loading.value = false; }
}

async function loadGroups() {
  try {
    const res: any = await usersApi.listGroups();
    groups.value = res;
  } catch {}
}

async function createUser() {
  if (!newUser.username) { ElMessage.warning('请输入用户名'); return; }
  try {
    await usersApi.create({ username: newUser.username, home: newUser.home || undefined, shell: newUser.shell, groups: newUser.groups || undefined });
    ElMessage.success('用户创建成功');
    showCreateDialog.value = false;
    Object.assign(newUser, { username: '', home: '', shell: '/bin/bash', groups: '' });
    loadUsers();
  } catch (error: any) { ElMessage.error(error.error || '创建失败'); }
}

async function deleteUser(user: any) {
  try {
    await ElMessageBox.confirm(`确定删除用户 ${user.username}?`, '确认', { type: 'warning' });
    await usersApi.delete(user.username);
    ElMessage.success('删除成功');
    loadUsers();
  } catch {}
}

onMounted(() => { loadUsers(); loadGroups(); });
</script>

<style scoped lang="scss">
.users-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
</style>
