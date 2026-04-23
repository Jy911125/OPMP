<template>
  <div class="network-page page-container">
    <div class="page-header">
      <h2>网络管理</h2>
      <el-button size="small" @click="loadAll">刷新</el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="网络接口" name="interfaces">
        <el-table :data="interfaces" v-loading="loading" size="small">
          <el-table-column prop="name" label="接口" width="120" />
          <el-table-column prop="ipv4" label="IPv4" width="150" />
          <el-table-column prop="ipv6" label="IPv6" min-width="250" show-overflow-tooltip />
          <el-table-column prop="mac" label="MAC" width="180" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'UP' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="连接列表" name="connections">
        <el-table :data="connections" v-loading="loading" size="small" max-height="calc(100vh - 260px)">
          <el-table-column prop="proto" label="协议" width="80" />
          <el-table-column label="本地地址" min-width="200">
            <template #default="{ row }">{{ row.localAddress }}:{{ row.localPort }}</template>
          </el-table-column>
          <el-table-column label="远程地址" min-width="200">
            <template #default="{ row }">{{ row.remoteAddress }}:{{ row.remotePort }}</template>
          </el-table-column>
          <el-table-column prop="state" label="状态" width="150" />
          <el-table-column prop="program" label="程序" width="150" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="防火墙" name="firewall">
        <div style="margin-bottom: 12px">
          <el-button type="primary" size="small" @click="showFirewallDialog = true">添加规则</el-button>
        </div>
        <el-table :data="firewallRules" v-loading="loading" size="small">
          <el-table-column label="动作" width="80">
            <template #default="{ row }">
              <el-tag :type="row.action === 'allow' ? 'success' : 'danger'" size="small">{{ row.action }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="from" label="来源" width="150" />
          <el-table-column prop="to" label="目标" width="150" />
          <el-table-column prop="port" label="端口" width="100" />
          <el-table-column prop="protocol" label="协议" width="80" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showFirewallDialog" title="添加防火墙规则" width="500px">
      <el-form :model="newRule" label-width="80px">
        <el-form-item label="动作">
          <el-select v-model="newRule.action">
            <el-option value="allow" label="允许" />
            <el-option value="deny" label="拒绝" />
          </el-select>
        </el-form-item>
        <el-form-item label="端口">
          <el-input v-model="newRule.port" placeholder="如: 80, 443" />
        </el-form-item>
        <el-form-item label="协议">
          <el-select v-model="newRule.protocol">
            <el-option value="tcp" label="TCP" />
            <el-option value="udp" label="UDP" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="newRule.from" placeholder="如: 192.168.1.0/24 (可选)" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFirewallDialog = false">取消</el-button>
        <el-button type="primary" @click="addFirewallRule">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { networkApi } from '@/api';
import { ElMessage } from 'element-plus';

const activeTab = ref('interfaces');
const interfaces = ref<any[]>([]);
const connections = ref<any[]>([]);
const firewallRules = ref<any[]>([]);
const loading = ref(false);
const showFirewallDialog = ref(false);
const newRule = reactive({ action: 'allow', port: '', protocol: 'tcp', from: '' });

async function loadAll() {
  loading.value = true;
  try {
    const [ifaces, conns, rules] = await Promise.all([
      networkApi.getInterfaces(),
      networkApi.getConnections(),
      networkApi.getFirewallRules(),
    ]);
    interfaces.value = ifaces as any;
    connections.value = conns as any;
    firewallRules.value = rules as any;
  } finally { loading.value = false; }
}

async function addFirewallRule() {
  try {
    await networkApi.addFirewallRule(newRule);
    ElMessage.success('规则已添加');
    showFirewallDialog.value = false;
    Object.assign(newRule, { action: 'allow', port: '', protocol: 'tcp', from: '' });
    loadAll();
  } catch (error: any) { ElMessage.error(error.error || '添加失败'); }
}

onMounted(loadAll);
</script>

<style scoped lang="scss">
.network-page { display: flex; flex-direction: column; gap: 12px; }
.page-header { display: flex; justify-content: space-between; align-items: center; h2 { font-size: 18px; } }
</style>
