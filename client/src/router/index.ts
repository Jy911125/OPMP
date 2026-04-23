import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '总览仪表盘', icon: 'Odometer' },
      },
      {
        path: 'system',
        name: 'System',
        redirect: '/system/monitor',
        meta: { title: '系统管理', icon: 'Monitor' },
        children: [
          {
            path: 'monitor',
            name: 'SystemMonitor',
            component: () => import('@/views/system/Monitor.vue'),
            meta: { title: '系统监控', icon: 'DataLine' },
          },
          {
            path: 'files',
            name: 'Filesystem',
            component: () => import('@/views/system/Filesystem.vue'),
            meta: { title: '文件管理', icon: 'Folder' },
          },
          {
            path: 'process',
            name: 'Process',
            component: () => import('@/views/system/Process.vue'),
            meta: { title: '进程管理', icon: 'List' },
          },
          {
            path: 'users',
            name: 'Users',
            component: () => import('@/views/system/Users.vue'),
            meta: { title: '用户管理', icon: 'User' },
          },
          {
            path: 'network',
            name: 'Network',
            component: () => import('@/views/system/Network.vue'),
            meta: { title: '网络管理', icon: 'Connection' },
          },
          {
            path: 'services',
            name: 'Services',
            component: () => import('@/views/system/Services.vue'),
            meta: { title: '服务管理', icon: 'Setting' },
          },
          {
            path: 'packages',
            name: 'Packages',
            component: () => import('@/views/system/Packages.vue'),
            meta: { title: '软件包管理', icon: 'Box' },
          },
          {
            path: 'cron',
            name: 'Cron',
            component: () => import('@/views/system/Cron.vue'),
            meta: { title: '定时任务', icon: 'Timer' },
          },
          {
            path: 'logs',
            name: 'Logs',
            component: () => import('@/views/system/Logs.vue'),
            meta: { title: '系统日志', icon: 'Document' },
          },
        ],
      },
      {
        path: 'docker',
        name: 'Docker',
        redirect: '/docker/containers',
        meta: { title: 'Docker管理', icon: 'Platform' },
        children: [
          {
            path: 'containers',
            name: 'Containers',
            component: () => import('@/views/docker/Containers.vue'),
            meta: { title: '容器管理', icon: 'Box' },
          },
          {
            path: 'images',
            name: 'Images',
            component: () => import('@/views/docker/Images.vue'),
            meta: { title: '镜像管理', icon: 'Picture' },
          },
          {
            path: 'volumes',
            name: 'Volumes',
            component: () => import('@/views/docker/Volumes.vue'),
            meta: { title: '卷管理', icon: 'Files' },
          },
          {
            path: 'networks',
            name: 'DockerNetworks',
            component: () => import('@/views/docker/Networks.vue'),
            meta: { title: '网络管理', icon: 'Share' },
          },
          {
            path: 'compose',
            name: 'Compose',
            component: () => import('@/views/docker/Compose.vue'),
            meta: { title: 'Compose管理', icon: 'Grid' },
          },
          {
            path: 'docker-info',
            name: 'DockerInfo',
            component: () => import('@/views/docker/Info.vue'),
            meta: { title: 'Docker信息', icon: 'InfoFilled' },
          },
        ],
      },
      {
        path: '3d',
        name: 'Visualization',
        component: () => import('@/views/Visualization.vue'),
        meta: { title: '3D可视化', icon: 'View' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');

  if (to.meta.requiresAuth !== false && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (to.name === 'Login' && token) {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
