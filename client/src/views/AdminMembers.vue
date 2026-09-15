<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>👥 会员管理</h1>
    </div>

    <!-- 操作反馈 -->
    <div v-if="msg.text" class="msg" :class="msg.type">
      {{ msg.text }}
      <button @click="msg.text = ''" class="msg-close">×</button>
    </div>

    <div class="members-table">
      <div class="mt-header">
        <span>用户</span><span>邮箱</span><span>等级</span><span>到期时间</span><span>购买次数</span><span>注册时间</span><span>操作</span>
      </div>
      <div class="mt-row" v-for="u in users" :key="u.id">
        <span>{{ u.nickname || '-' }}</span>
        <span class="mono">{{ u.email }}</span>
        <span class="tier-badge" :class="u.subscription_tier">{{ tierLabel(u.subscription_tier) }}</span>
        <span class="mono">{{ u.subscription_expire ? formatDate(u.subscription_expire) : '-' }}</span>
        <span class="mono">{{ u.purchase_count }}</span>
        <span class="mono">{{ formatDate(u.created_at) }}</span>
        <div class="actions">
          <!-- 升级 -->
          <select v-if="actionTarget === u.id" v-model="upgradeTier" class="tier-select" @change="doUpgrade(u.id)" @blur="cancelAction">
            <option value="">选择等级...</option>
            <option value="monthly">月度（30天）</option>
            <option value="yearly">年度（365天）</option>
          </select>
          <button v-else @click="startUpgrade(u.id)" class="btn btn-sm btn-ghost" :disabled="u.subscription_tier === 'yearly'" title="升级会员">
            升级
          </button>
          <!-- 重置密码 -->
          <button @click="resetPassword(u)" class="btn btn-sm btn-outline" title="重置密码后发临时密码给用户">
            重置密码
          </button>
        </div>
      </div>
      <div v-if="!users.length" class="empty">暂无会员数据</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'

const users = ref([])
const msg = ref({ type: 'info', text: '' })
const actionTarget = ref('')
const upgradeTier = ref('')

function tierLabel(t) { return { free: '免费', monthly: '月度', yearly: '年度' }[t] || t }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' }) }

function showMsg(type, text) { msg.value = { type, text }; setTimeout(() => { msg.value.text = '' }, 6000) }

function startUpgrade(id) { actionTarget.value = id; upgradeTier.value = '' }
function cancelAction() { actionTarget.value = '' }

async function doUpgrade(id) {
  if (!upgradeTier.value) { cancelAction(); return }
  try {
    const { data } = await api.put(`/admin/members/${id}/upgrade`, { tier: upgradeTier.value })
    showMsg('success', `✅ 升级成功！到期：${formatDate(data.expireAt)}`)
    cancelAction()
    await loadUsers()
  } catch (e) { showMsg('error', '❌ 升级失败：' + (e.response?.data?.error || e.message)) }
}

async function resetPassword(user) {
  if (!confirm(`确定重置 ${user.email} 的密码？`)) return
  try {
    const { data } = await api.put(`/admin/members/${user.id}/reset-password`)
    showMsg('success', `✅ 新密码已生成：${data.tempPassword}  （请发给用户）`)
  } catch (e) { showMsg('error', '❌ 重置失败：' + (e.response?.data?.error || e.message)) }
}

async function loadUsers() {
  try { const { data } = await api.get('/admin/members'); users.value = data.users } catch (e) { showMsg('error', '加载失败') }
}

onMounted(loadUsers)
</script>

<style scoped>
.page { max-width: 1300px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 24px; }

.msg { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
.msg.info { background: rgba(88,166,255,0.1); border: 1px solid rgba(88,166,255,0.3); color: #58A6FF; }
.msg.success { background: rgba(63,185,80,0.1); border: 1px solid rgba(63,185,80,0.3); color: #3FB950; }
.msg.error { background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3); color: #F85149; }
.msg-close { background: none; border: none; color: inherit; cursor: pointer; font-size: 18px; padding: 0 4px; opacity: 0.7; }

.members-table { background: #161B22; border: 1px solid #21262D; border-radius: 12px; overflow: hidden; }
.mt-header, .mt-row { display: grid; grid-template-columns: 1fr 1.5fr 90px 140px 70px 140px 130px; gap: 8px; padding: 12px 16px; font-size: 13px; align-items: center; }
.mt-header { background: #21262D; color: #8B949E; font-size: 12px; font-weight: 600; }
.mt-row { border-bottom: 1px solid #21262D; }
.mt-row:last-child { border-bottom: none; }

.tier-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; display: inline-block; }
.tier-badge.free { background: #21262D; color: #8B949E; }
.tier-badge.monthly { background: rgba(88,166,255,0.2); color: #58A6FF; }
.tier-badge.yearly { background: rgba(255,191,46,0.2); color: #FFBF2E; }

.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.tier-select { padding: 4px 8px; background: #21262D; border: 1px solid #58A6FF; border-radius: 6px; color: #E6EDF3; font-size: 12px; }

.btn { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; white-space: nowrap; }
.btn-sm { padding: 4px 10px; font-size: 11px; }
.btn-ghost { background: #21262D; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { background: #30363D; color: #E6EDF3; }
.btn-ghost:disabled { opacity: 0.35; cursor: not-allowed; }
.btn-outline { background: transparent; color: #58A6FF; border: 1px solid #58A6FF; }
.btn-outline:hover { background: rgba(88,166,255,0.1); }

.empty { text-align: center; color: #8B949E; padding: 40px; }
.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8B949E; }
</style>
