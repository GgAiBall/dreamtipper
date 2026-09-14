<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>👥 会员管理</h1>
    </div>
    <div class="members-table">
      <div class="mt-header">
        <span>用户</span><span>邮箱</span><span>等级</span><span>到期时间</span><span>购买次数</span><span>注册时间</span>
      </div>
      <div class="mt-row" v-for="u in users" :key="u.id">
        <span>{{ u.nickname }}</span>
        <span class="mono">{{ u.email }}</span>
        <span class="tier-badge" :class="u.subscription_tier">{{ tierLabel(u.subscription_tier) }}</span>
        <span class="mono">{{ u.subscription_expire ? formatDate(u.subscription_expire) : '-' }}</span>
        <span class="mono">{{ u.purchase_count }}</span>
        <span class="mono">{{ formatDate(u.created_at) }}</span>
      </div>
      <div v-if="!users.length" class="empty">暂无会员数据</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'
const users = ref([])
function tierLabel(t) { return { free: '免费', monthly: '月度', yearly: '年度' }[t] || t }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' }) }
onMounted(async () => {
  try { const { data } = await api.get('/admin/members'); users.value = data.users } catch (e) { console.error(e) }
})
</script>

<style scoped>
.page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 24px; }
.members-table { background: #161B22; border: 1px solid #21262D; border-radius: 12px; overflow: hidden; }
.mt-header, .mt-row { display: grid; grid-template-columns: 1fr 1.5fr 100px 140px 80px 140px; gap: 8px; padding: 12px 16px; font-size: 13px; align-items: center; }
.mt-header { background: #21262D; color: #8B949E; font-size: 12px; font-weight: 600; }
.mt-row { border-bottom: 1px solid #21262D; }
.mt-row:last-child { border-bottom: none; }
.tier-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
.tier-badge.free { background: #21262D; color: #8B949E; }
.tier-badge.monthly { background: rgba(88,166,255,0.2); color: #58A6FF; }
.tier-badge.yearly { background: rgba(255,191,46,0.2); color: #FFBF2E; }
.empty { text-align: center; color: #8B949E; padding: 40px; }
.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8B949E; }
</style>
