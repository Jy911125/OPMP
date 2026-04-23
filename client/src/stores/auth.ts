import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { authApi } from '@/api';
import { useRouter } from 'vue-router';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('token'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isOperator = computed(() => user.value?.role === 'operator' || isAdmin.value);

  async function login(username: string, password: string) {
    const res: any = await authApi.login(username, password);
    token.value = res.accessToken;
    refreshToken.value = res.refreshToken;
    user.value = res.user;
    localStorage.setItem('token', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
    return res;
  }

  async function refresh() {
    if (!refreshToken.value) return;
    const res: any = await authApi.refreshToken(refreshToken.value);
    token.value = res.accessToken;
    localStorage.setItem('token', res.accessToken);
    return res;
  }

  function logout() {
    user.value = null;
    token.value = null;
    refreshToken.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    const router = useRouter();
    router.push('/login');
  }

  async function fetchUser() {
    if (!token.value) return;
    try {
      const res: any = await authApi.me();
      user.value = res.user;
    } catch {
      logout();
    }
  }

  function loadFromStorage() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      user.value = JSON.parse(savedUser);
    }
    token.value = localStorage.getItem('token');
    refreshToken.value = localStorage.getItem('refreshToken');
  }

  loadFromStorage();

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    isOperator,
    login,
    logout,
    refresh,
    fetchUser,
  };
});
