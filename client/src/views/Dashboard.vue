<template>
  <div class="page">
    <div class="page-header">
      <h1>👤 会员中心</h1>
      <p>管理您的订阅、数据记录和解锁历史</p>
    </div>

    <div class="user-card">
      <div class="uc-info">
        <div class="uc-name">{{ auth.user?.nickname }}</div>
        <div class="uc-email">{{ auth.user?.email }}</div>
      </div>
      <div class="uc-tier">
        <span class="tier-badge" :class="auth.tier">{{ tierLabel }}</span>
        <span class="tier-expire" v-if="auth.user?.subscription_expire">到期：{{ formatDate(auth.user.subscription_expire) }}</span>
      </div>
      <div class="uc-actions">
        <router-link to="/profile" class="btn btn-ghost btn-sm">个人设置</router-link>
        <router-link to="/plans" class="btn btn-primary btn-sm">升级方案</router-link>
      </div>
    </div>

    <div class="dash-sections">
      <div class="dash-section">
        <h3>📊 今日数据</h3>
        <div class="mini-kpi" v-if="todayStats">
          <div class="mk-item"><span>发布</span><strong class="mono">{{ todayStats.total }}</strong></div>
          <div class="mk-item win"><span>胜</span><strong class="mono">{{ todayStats.wins }}</strong></div>
          <div class="mk-item loss"><span>负</span><strong class="mono">{{ todayStats.losses }}</strong></div>
        </div>
      </div>

      <div class="dash-section">
        <h3>🔓 我的解锁记录</h3>
        <div class="purchase-list" v-if="purchases.length">
          <div class="pl-item" v-for="p in purchases" :key="p.id">
            <span>{{ p.plan_name || '订阅' }}</span>
            <span class="mono">¥{{ (p.amount / 100).toFixed(0) }}</span>
            <span class="status-tag" :class="p.status">{{ p.status }}</span>
            <span class="mono">{{ formatDate(p.paid_at) }}</span>
          </div>
        </div>
        <div v-else class="empty">暂无购买记录</div>
      </div>

      <div class="dash-section">
        <h3>⚡ 快捷入口</h3>
        <div class="shortcuts">
          <router-link to="/data" class="shortcut-item">📊 扫盘数据</router-link>
          <router-link to="/stats" class="shortcut-item">📈 战绩统计</router-link>
          <router-link to="/plans" class="shortcut-item">📋 方案市场</router-link>
          <router-link to="/admin" v-if="auth.isAdmin" class="shortcut-item admin">⚙️ 管理后台</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/stores/auth'

const auth = useAuthStore()
const purchases = ref([])
const todayStats = ref(null)
const tierLabel = computed(() => ({ free: '🆓 免费会员', monthly: '💎 月度会员', yearly: '👑 年度会员' }[auth.tier] || '免费会员'))

function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) }

onMounted(async () => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const [pRes, statsRes] = await Promise.all([
      api.get('/purchases/me'),
      api.get('/admin/dashboard'),
    ])
    purchases.value = pRes.data.purchases
    todayStats.value = statsRes.data.todayStats
  } catch (e) { console.error(e) }
})
</script>

<style scoped>
.page { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.user-card { background: #161B22; border: 1px solid #21262D; border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: 32px; }
.uc-info { flex: 1; }
.uc-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.uc-email { font-size: 13px; color: #8B949E; }
.uc-tier { display: flex; flex-direction: column; gap: 4px; }
.tier-badge { font-size: 14px; padding: 4px 12px; border-radius: 20px; font-weight: 600; display: inline-block; }
.tier-badge.free { background: #21262D; color: #8B949E; }
.tier-badge.monthly { background: rgba(88,166,255,0.2); color: #58A6FF; }
.tier-badge.yearly { background: rgba(255,191,46,0.2); color: #FFBF2E; }
.tier-expire { font-size: 12px; color: #8B949E; }
.uc-actions { display: flex; gap: 8px; }
.dash-sections { display: flex; flex-direction: column; gap: 20px; }
.dash-section { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.dash-section h3 { font-size: 15px; margin-bottom: 16px; color: #E6EDF3; }
.mini-kpi { display: flex; gap: 24px; }
.mk-item { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #8B949E; }
.mk-item strong { font-size: 22px; font-weight: 700; }
.mk-item.win strong { color: #3FB950; }
.mk-item.loss strong { color: #F85149; }
.purchase-list { display: flex; flex-direction: column; gap: 8px; }
.pl-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #21262D; border-radius: 8px; font-size: 13px; }
.status-tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.status-tag.paid { background: rgba(63,185,80,0.15); color: #3FB950; }
.status-tag.pending { background: rgba(240,136,62,0.15); color: #F0883E; }
.shortcuts { display: flex; gap: 12px; flex-wrap: wrap; }
.shortcut-item { padding: 12px 20px; background: #21262D; border-radius: 8px; font-size: 14px; color: #8B949E; transition: all 0.2s; flex: 1; min-width: 120px; text-align: center; }
.shortcut-item:hover { background: #30363D; color: #E6EDF3; }
.shortcut-item.admin { color: #F0883E; }
.empty { color: #8B949E; font-size: 13px; text-align: center; padding: 20px; }
.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; text-decoration: none; transition: all 0.2s; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
