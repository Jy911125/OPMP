<template>
  <div class="login-container">
    <div class="login-bg"></div>
    <div class="login-card">
      <div class="login-header">
        <h1>OPMP</h1>
        <p>虚拟数字监控平台</p>
      </div>
      <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="Lock"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            style="width: 100%"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>
      <div class="login-hint">
        <p>默认账号: admin / opmp@2026</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
import type { FormInstance } from 'element-plus';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  username: '',
  password: '',
});

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      await authStore.login(form.username, form.password);
      ElMessage.success('登录成功');
      const redirect = (router.currentRoute.value.query.redirect as string) || '/';
      router.push(redirect);
    } catch (error: any) {
      ElMessage.error(error.error || '登录失败');
    } finally {
      loading.value = false;
    }
  });
}
</script>

<style scoped lang="scss">
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: var(--opmp-bg);
}

.login-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%);
}

.login-card {
  position: relative;
  width: 400px;
  padding: 40px;
  background: var(--opmp-bg-card);
  border: 1px solid var(--opmp-border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;

  h1 {
    font-size: 32px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--opmp-primary), var(--opmp-info));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: 4px;
  }

  p {
    color: var(--opmp-text-secondary);
    margin-top: 8px;
    font-size: 14px;
  }
}

.login-hint {
  text-align: center;
  margin-top: 16px;

  p {
    color: var(--opmp-text-secondary);
    font-size: 12px;
  }
}
</style>
