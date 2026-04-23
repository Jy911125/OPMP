<template>
  <div class="compose-page page-container">
    <div class="page-header">
      <h2>Docker Compose</h2>
      <el-button type="primary" size="small" @click="showEditor = true">新建Compose</el-button>
    </div>

    <el-alert type="info" :closable="false" style="margin-bottom: 16px">
      Docker Compose 管理功能允许您通过 YAML 配置文件管理多容器应用。上传或编辑 docker-compose.yml 文件后可直接部署。
    </el-alert>

    <div class="compose-editor" v-if="showEditor">
      <div class="editor-toolbar">
        <span>docker-compose.yml</span>
        <div>
          <el-button size="small" @click="showEditor = false">取消</el-button>
          <el-button type="primary" size="small" @click="deployCompose">部署</el-button>
        </div>
      </div>
      <el-input v-model="composeYaml" type="textarea" :rows="20" spellcheck="false"
        style="font-family: 'Fira Code', monospace; font-size: 13px" />
    </div>

    <div v-else>
      <el-empty description="暂无Compose项目" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const showEditor = ref(false);
const composeYaml = ref(`version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: example
    volumes:
      - db_data:/var/lib/mysql

volumes:
  db_data:
`);

async function deployCompose() {
  ElMessage.info('Docker Compose 部署功能需要在服务端实现完整支持');
}
</script>

<style scoped lang="scss">
.compose-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
.compose-editor { background: var(--opmp-bg-card); border: 1px solid var(--opmp-border); border-radius: 8px; overflow: hidden; }
.editor-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--opmp-bg-secondary); border-bottom: 1px solid var(--opmp-border); }
</style>
