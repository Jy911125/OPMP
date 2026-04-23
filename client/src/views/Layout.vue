<template>
  <div class="layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 v-show="!sidebarCollapsed">OPMP</h1>
        <span v-show="sidebarCollapsed" class="sidebar-logo-mini">O</span>
      </div>
      <el-scrollbar>
        <el-menu
          :default-active="activeMenu"
          :collapse="sidebarCollapsed"
          :collapse-transition="false"
          background-color="transparent"
          text-color="var(--opmp-text-secondary)"
          active-text-color="var(--opmp-primary)"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <template #title>总览仪表盘</template>
          </el-menu-item>

          <el-sub-menu index="system">
            <template #title>
              <el-icon><Monitor /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/system/monitor">系统监控</el-menu-item>
            <el-menu-item index="/system/files">文件管理</el-menu-item>
            <el-menu-item index="/system/process">进程管理</el-menu-item>
            <el-menu-item index="/system/users">用户管理</el-menu-item>
            <el-menu-item index="/system/network">网络管理</el-menu-item>
            <el-menu-item index="/system/services">服务管理</el-menu-item>
            <el-menu-item index="/system/packages">软件包</el-menu-item>
            <el-menu-item index="/system/cron">定时任务</el-menu-item>
            <el-menu-item index="/system/logs">系统日志</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="docker">
            <template #title>
              <el-icon><Platform /></el-icon>
              <span>Docker管理</span>
            </template>
            <el-menu-item index="/docker/containers">容器管理</el-menu-item>
            <el-menu-item index="/docker/images">镜像管理</el-menu-item>
            <el-menu-item index="/docker/volumes">卷管理</el-menu-item>
            <el-menu-item index="/docker/networks">网络管理</el-menu-item>
            <el-menu-item index="/docker/compose">Compose</el-menu-item>
            <el-menu-item index="/docker/docker-info">Docker信息</el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/3d">
            <el-icon><View /></el-icon>
            <template #title>3D可视化</template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </aside>

    <div class="main-area">
      <header class="header">
        <div class="header-left">
          <el-button text @click="sidebarCollapsed = !sidebarCollapsed">
            <el-icon :size="20"><Fold v-if="!sidebarCollapsed" /><Expand v-else /></el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item.path">
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tag :type="monitorStore.connected ? 'success' : 'danger'" size="small">
            {{ monitorStore.connected ? '已连接' : '未连接' }}
          </el-tag>
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              {{ authStore.user?.username || 'admin' }}
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                <el-dropdown-item command="theme">
                  {{ isDark ? '浅色模式' : '深色模式' }}
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMonitorStore } from '@/stores/monitor';
import { useDark, useToggle } from '@vueuse/core';

const route = useRoute();
const authStore = useAuthStore();
const monitorStore = useMonitorStore();
const isDark = useDark();
const sidebarCollapsed = ref(false);

const activeMenu = computed(() => route.path);

const breadcrumbs = computed(() => {
  const matched = route.matched.filter(r => r.meta.title);
  return matched.map(r => ({ path: r.path, title: r.meta.title as string }));
});

function handleCommand(command: string) {
  switch (command) {
    case 'logout':
      authStore.logout();
      break;
    case 'theme':
      useToggle(isDark)();
      break;
  }
}

onMounted(() => {
  monitorStore.connectWebSocket();
  monitorStore.fetchSystemInfo();
});

onUnmounted(() => {
  monitorStore.disconnectWebSocket();
});
</script>

<style scoped lang="scss">
.layout {
  display: flex;
  height: 100vh;
  width: 100%;
}

.sidebar {
  width: var(--opmp-sidebar-width);
  background: var(--opmp-bg-secondary);
  border-right: 1px solid var(--opmp-border);
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .sidebar-collapsed & {
    width: 64px;
  }
}

.sidebar-header {
  height: var(--opmp-header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--opmp-border);

  h1 {
    font-size: 20px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--opmp-primary), var(--opmp-info));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: 3px;
  }

  .sidebar-logo-mini {
    font-size: 22px;
    font-weight: 700;
    color: var(--opmp-primary);
  }
}

:deep(.el-menu) {
  border-right: none;
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
  height: 44px;
  line-height: 44px;
}

:deep(.el-menu-item:hover),
:deep(.el-sub-menu__title:hover) {
  background: rgba(59, 130, 246, 0.1) !important;
}

:deep(.el-menu-item.is-active) {
  background: rgba(59, 130, 246, 0.15) !important;
  border-right: 3px solid var(--opmp-primary);
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  height: var(--opmp-header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--opmp-bg-secondary);
  border-bottom: 1px solid var(--opmp-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--opmp-text);
  cursor: pointer;
  font-size: 14px;
}

.content {
  flex: 1;
  overflow: hidden;
  background: var(--opmp-bg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
