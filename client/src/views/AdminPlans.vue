<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>📋 方案管理</h1>
    </div>

    <div class="plan-list">
      <div class="plan-item" v-for="p in plans" :key="p.id">
        <div class="pi-main">
          <div class="pi-name">{{ p.name }}</div>
          <div class="pi-desc">{{ p.description }}</div>
          <div class="pi-meta">
            <span class="mono">¥{{ (p.price / 100).toFixed(0) }}</span>
            <span>{{ p.subscriber_count }}人订阅</span>
            <span class="tier-tag" :class="p.tier_required">{{ tierLabel(p.tier_required) }}</span>
            <span :class="p.is_active ? 'active' : 'inactive'">{{ p.is_active ? '✅ 已上线' : '⛔ 已下线' }}</span>
          </div>
        </div>
        <div class="pi-actions">
          <button @click="toggleActive(p)" class="btn btn-sm" :class="p.is_active ? 'btn-ghost' : 'btn-primary'" :disabled="toggling === p.id">{{ toggling === p.id ? '处理中...' : (p.is_active ? '下架' : '上架') }}</button>
          <button @click="editPlan(p)" class="btn btn-ghost btn-sm">编辑</button>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>{{ editing ? '编辑方案' : '添加方案' }}</h3>
      <form @submit.prevent="savePlan" class="plan-form">
        <div class="form-row">
          <div class="form-group"><label>方案名称</label><input v-model="form.name" required /></div>
          <div class="form-group"><label>价格(元)</label><input v-model.number="form.priceYuan" type="number" step="1" required /></div>
          <div class="form-group"><label>权限要求</label>
            <select v-model="form.tier_required">
              <option value="free">免费可见</option><option value="monthly">月度可见</option><option value="yearly">年度可见</option>
            </select>
          </div>
          <div class="form-group"><label>上架状态</label>
            <label class="switch"><input type="checkbox" v-model="form.is_active" :true-value="1" :false-value="0" /> 立即上架公开</label>
          </div>
        </div>
        <div class="form-group"><label>描述</label><textarea v-model="form.description" rows="3" placeholder="方案详细介绍..."></textarea></div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存方案' }}</button>
          <button type="button" v-if="editing" @click="editing = null" class="btn btn-ghost">取消</button>
        </div>
        <div v-if="msg" class="msg" :class="msg.error ? 'error' : 'success'">{{ msg.text }}</div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'
const plans = ref([])
const editing = ref(null)
const saving = ref(false)
const toggling = ref(null)
const msg = ref(null)
const form = ref({ name: '', description: '', priceYuan: 0, tier_required: 'free', is_active: 1 })

function tierLabel(t) { return { free: '免费', monthly: '月度', yearly: '年度' }[t] || t }

function editPlan(p) {
  editing.value = p.id
  form.value = { name: p.name, description: p.description, priceYuan: p.price / 100, tier_required: p.tier_required, is_active: p.is_active ? 1 : 0 }
}

async function toggleActive(p) {
  toggling.value = p.id
  try {
    await api.put(`/admin/plans/${p.id}`, { name: p.name, description: p.description, price: p.price, tier_required: p.tier_required, is_active: p.is_active ? 0 : 1 })
    await loadPlans()
  } catch (e) { console.error(e) }
  finally { toggling.value = null }
}

async function savePlan() {
  saving.value = true
  msg.value = null
  try {
    const payload = { ...form.value, price: Math.round(form.value.priceYuan * 100), is_active: form.value.is_active ? 1 : 0 }
    if (editing.value) await api.put(`/admin/plans/${editing.value}`, payload)
    else await api.post('/admin/plans', payload)
    msg.value = { text: '保存成功', error: false }
    editing.value = null
    await loadPlans()
  } catch (e) {
    msg.value = { text: e.response?.data?.error || '保存失败', error: true }
  } finally { saving.value = false }
}

async function loadPlans() {
  try { const { data } = await api.get('/admin/plans'); plans.value = data.plans } catch (e) { console.error(e) }
}

onMounted(loadPlans)
</script>

<style scoped>
.page { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 24px; }
.plan-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; }
.plan-item { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.pi-name { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.pi-desc { font-size: 13px; color: #8B949E; margin-bottom: 8px; }
.pi-meta { display: flex; gap: 12px; font-size: 12px; color: #8B949E; align-items: center; }
.tier-tag { padding: 2px 8px; border-radius: 6px; background: #21262D; }
.tier-tag.monthly { background: rgba(88,166,255,0.15); color: #58A6FF; }
.tier-tag.yearly { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.active { color: #3FB950; }
.inactive { color: #F85149; }
.form-section { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.form-section h3 { font-size: 15px; margin-bottom: 16px; }
.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 12px; color: #8B949E; }
.form-group input, .form-group select, .form-group textarea { padding: 9px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; }
.form-group textarea { resize: vertical; }
.switch { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #E6EDF3; cursor: pointer; padding: 9px 0; }
.switch input { width: 16px; height: 16px; accent-color: #58A6FF; }
.form-actions { display: flex; gap: 12px; margin-top: 12px; }
.msg { padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-top: 12px; }
.msg.success { background: rgba(63,185,80,0.1); border: 1px solid #3FB950; color: #3FB950; }
.msg.error { background: rgba(248,81,73,0.1); border: 1px solid #F85149; color: #F85149; }
.btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
