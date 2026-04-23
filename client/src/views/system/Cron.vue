<template>
  <div class="cron-page page-container">
    <div class="page-header">
      <h2>定时任务</h2>
      <el-button type="primary" size="small" @click="showCreateDialog = true">新建任务</el-button>
    </div>

    <el-table :data="jobs" v-loading="loading" size="small">
      <el-table-column prop="id" label="#" width="60" />
      <el-table-column prop="schedule" label="Cron表达式" width="180" />
      <el-table-column label="执行时间" width="200">
        <template #default="{ row }">
          <span style="color: var(--opmp-text-secondary); font-size: 12px">{{ parseCron(row.schedule) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="command" label="命令" min-width="300" show-overflow-tooltip />
      <el-table-column prop="user" label="用户" width="100" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button text size="small" type="danger" @click="deleteJob(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreateDialog" title="新建定时任务" width="600px">
      <el-form :model="newJob" label-width="100px">
        <el-form-item label="分钟">
          <el-input v-model="newJob.minute" placeholder="0-59 或 *" style="width: 80px" />
        </el-form-item>
        <el-form-item label="小时">
          <el-input v-model="newJob.hour" placeholder="0-23 或 *" style="width: 80px" />
        </el-form-item>
        <el-form-item label="日">
          <el-input v-model="newJob.day" placeholder="1-31 或 *" style="width: 80px" />
        </el-form-item>
        <el-form-item label="月">
          <el-input v-model="newJob.month" placeholder="1-12 或 *" style="width: 80px" />
        </el-form-item>
        <el-form-item label="星期">
          <el-input v-model="newJob.weekday" placeholder="0-7 或 *" style="width: 80px" />
        </el-form-item>
        <el-form-item label="命令">
          <el-input v-model="newJob.command" placeholder="要执行的命令" />
        </el-form-item>
        <el-form-item label="预览">
          <el-tag>{{ newJob.minute }} {{ newJob.hour }} {{ newJob.day }} {{ newJob.month }} {{ newJob.weekday }} {{ newJob.command }}</el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createJob">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { cronApi } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const jobs = ref<any[]>([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const newJob = reactive({ minute: '*', hour: '*', day: '*', month: '*', weekday: '*', command: '' });

async function loadJobs() {
  loading.value = true;
  try {
    const res: any = await cronApi.list();
    jobs.value = res;
  } finally { loading.value = false; }
}

async function createJob() {
  if (!newJob.command) { ElMessage.warning('请输入命令'); return; }
  try {
    const schedule = `${newJob.minute} ${newJob.hour} ${newJob.day} ${newJob.month} ${newJob.weekday}`;
    await cronApi.add(schedule, newJob.command);
    ElMessage.success('任务创建成功');
    showCreateDialog.value = false;
    Object.assign(newJob, { minute: '*', hour: '*', day: '*', month: '*', weekday: '*', command: '' });
    loadJobs();
  } catch (error: any) { ElMessage.error(error.error || '创建失败'); }
}

async function deleteJob(job: any) {
  try {
    await ElMessageBox.confirm('确定删除此定时任务?', '确认', { type: 'warning' });
    await cronApi.delete(job.id);
    ElMessage.success('删除成功');
    loadJobs();
  } catch {}
}

function parseCron(expr: string): string {
  const parts = expr.split(' ');
  if (parts.length < 5) return expr;
  const [min, hour, day, month, weekday] = parts;
  if (min === '*' && hour === '*') return '每小时执行';
  if (min === '0' && hour === '*') return '每小时整点执行';
  if (min === '0' && hour !== '*') return `每天 ${hour}:00 执行`;
  if (min !== '*' && hour !== '*') return `每天 ${hour}:${min} 执行`;
  return expr;
}

onMounted(loadJobs);
</script>

<style scoped lang="scss">
.cron-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
</style>
