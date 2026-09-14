<template>
  <div class="page">
    <div class="page-header">
      <h1>⚙️ 管理后台</h1>
      <div class="admin-nav">
        <router-link to="/admin" class="nav-item active">总览</router-link>
        <router-link to="/admin/upload" class="nav-item">扫盘数据</router-link>
        <router-link to="/admin/plans-upload" class="nav-item">📦 上传方案</router-link>
        <router-link to="/admin/members" class="nav-item">会员管理</router-link>
        <router-link to="/admin/plans" class="nav-item">方案定义</router-link>
        <router-link to="/" class="nav-item">← 返回前台</router-link>
      </div>
    </div>

    <div v-if="dash" class="dash-grid">
      <div class="dash-card">
        <div class="dc-icon">👥</div>
        <div class="dc-val mono">{{ dash.totalUsers }}</div>
        <div class="dc-label">注册用户</div>
        <div class="dc-sub">+{{ dash.newUsers7d }} 近7天</div>
      </div>
      <div class="dash-card">
        <div class="dc-icon">📊</div>
        <div class="dc-val mono">{{ dash.totalSweeps }}</div>
        <div class="dc-label">扫盘记录</div>
        <div class="dc-sub" style="color:#F0883E">📝 {{ dash.totalDrafts || 0 }} 待发布</div>
      </div>
      <div class="dash-card">
        <div class="dc-icon">📋</div>
        <div class="dc-val mono">{{ dash.totalPlans }}</div>
        <div class="dc-label">方案数量</div>
      </div>
      <div class="dash-card">
        <div class="dc-icon">💰</div>
        <div class="dc-val mono">¥{{ (dash.totalRevenue / 100).toLocaleString() }}</div>
        <div class="dc-label">总收入(分)</div>
      </div>
      <div class="dash-card">
        <div class="dc-icon">⚡</div>
        <div class="dc-val mono win">{{ dash.todayStats?.wins || 0 }}</div>
        <div class="dc-label">今日胜</div>
      </div>
      <div class="dash-card">
        <div class="dc-icon">💔</div>
        <div class="dc-val mono loss">{{ dash.todayStats?.losses || 0 }}</div>
        <div class="dc-label">今日负</div>
      </div>
    </div>

    <div class="admin-section">
      <h3>📋 快速操作</h3>
      <div class="quick-actions">
        <router-link to="/admin/upload" class="qa-btn">📊 管理扫盘数据</router-link>
        <router-link to="/admin/plans-upload" class="qa-btn">📦 上传推荐方案</router-link>
        <router-link to="/admin/plans" class="qa-btn">📋 管理方案定义</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'

const dash = ref(null)
onMounted(async () => {
  try { const { data } = await api.get('/admin/dashboard'); dash.value = data } catch (e) { console.error(e) }
})
</script>

<style scoped>
.page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 16px; }
.admin-nav { display: flex; gap: 4px; flex-wrap: wrap; }
.nav-item { padding: 8px 14px; border-radius: 8px; font-size: 13px; color: #8B949E; transition: all 0.2s; text-decoration: none; }
.nav-item:hover { background: #21262D; color: #E6EDF3; }
.nav-item.active { background: #58A6FF; color: #0D1117; font-weight: 600; }
.dash-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
.dash-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; text-align: center; }
.dc-icon { font-size: 28px; margin-bottom: 8px; }
.dc-val { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
.dc-label { font-size: 13px; color: #8B949E; margin-bottom: 4px; }
.dc-sub { font-size: 11px; color: #3FB950; }
.win { color: #3FB950; }
.loss { color: #F85149; }
.admin-section { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.admin-section h3 { font-size: 15px; margin-bottom: 16px; }
.quick-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.qa-btn { padding: 10px 20px; background: #21262D; border: 1px solid #30363D; border-radius: 8px; color: #8B949E; font-size: 13px; text-decoration: none; transition: all 0.2s; }
.qa-btn:hover { background: #30363D; color: #E6EDF3; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
