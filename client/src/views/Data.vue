<template>
  <div class="page">
    <div class="page-header">
      <h1>📊 扫盘数据</h1>
      <p>付费用户可查看完整赔率和信心分析</p>
    </div>

    <div class="filters">
      <input v-model="dateFilter" type="date" class="filter-input" @change="loadData" />
      <input v-model="leagueFilter" type="text" placeholder="搜索联赛..." class="filter-input" @input="debouncedLoad" />
      <button @click="loadData" class="btn btn-primary btn-sm">刷新</button>
      <router-link to="/admin/upload" v-if="auth.isAdmin" class="btn btn-ghost btn-sm">上传数据</router-link>
      <!-- 管理员批量操作 -->
      <template v-if="auth.isAdmin">
        <span class="divider-v"></span>
        <button @click="selectAll" class="btn btn-ghost btn-sm">全选</button>
        <button @click="deselectAll" class="btn btn-ghost btn-sm">反选</button>
        <button v-if="selectedIds.size > 0" @click="confirmBatchDelete" class="btn btn-danger btn-sm">
          删除所选 <span class="badge">{{ selectedIds.size }}</span>
        </button>
      </template>
      <!-- 免费用户解锁提示 -->
      <span v-if="auth.isLoggedIn && auth.tier === 'free'" class="unlock-tip">
        今日剩余解锁: {{ dailyUnlocksLeft }} / 3
        <span class="unlock-desc">（会员无限解锁）</span>
      </span>
    </div>

    <!-- 解锁成功提示 -->
    <div v-if="unlockMsg.text" class="msg" :class="unlockMsg.type">
      {{ unlockMsg.text }}
      <button @click="unlockMsg.text = ''" class="msg-close">×</button>
    </div>

    <div class="records-table" v-if="records.length">
      <div class="table-header">
        <span class="check-cell" v-if="auth.isAdmin">
          <input type="checkbox"
            :checked="selectedIds.size === records.length && records.length > 0"
            :indeterminate="selectedIds.size > 0 && selectedIds.size < records.length"
            @change="selectedIds.size === records.length && records.length > 0 ? deselectAll() : selectAll()" />
        </span>
        <span>联赛</span><span>主队</span><span>客队</span><span>时间</span>
        <span>玩法推荐</span><span>信心</span><span>权限</span><span>结果</span>
        <span v-if="auth.isLoggedIn && auth.tier === 'free'">操作</span>
      </div>
      <div class="table-row" :class="{ selected: selectedIds.has(r.id) }" v-for="r in records" :key="r.id">
        <span class="check-cell" v-if="auth.isAdmin">
          <input type="checkbox" :value="r.id" v-model="selectedIdsArr" />
        </span>
        <span class="league-tag">{{ r.league }}</span>
        <span>{{ r.home_team }}</span>
        <span>{{ r.away_team }}</span>
        <span class="mono">{{ formatTime(r.match_time) }}</span>

        <!-- 玩法列：已解锁/免费记录显示玩法；未解锁显示锁定提示 -->
        <div class="plays" v-if="r.odds != null">
          <div v-for="(p, key) in parsePlays(r.handicap)" :key="key" class="play-line" :class="p.result">
            <span class="play-label">{{ playLabel(key) }}</span>
            <span class="play-pick">{{ p.pick || '-' }}</span>
            <span class="play-result">{{ resultDot(p.result) }}</span>
          </div>
        </div>
        <div v-else class="plays locked">
          <div class="lock-msg">
            <span class="lock-icon">🔒</span>
            <span>查看完整方案</span>
          </div>
        </div>

        <span class="stars">
          <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= (r.confidence_stars || 0) }">★</span>
        </span>
        <span class="tier-tag" :class="r.tier_required">{{ tierTag(r.tier_required) }}</span>
        <span class="result-tag" :class="r.result">{{ resultLabel(r.result) }}</span>

        <!-- 免费用户解锁按钮 -->
        <span v-if="auth.isLoggedIn && auth.tier === 'free'" class="unlock-cell">
          <button v-if="r.odds != null" class="btn btn-xs btn-ghost" disabled>已解锁</button>
          <button v-else-if="dailyUnlocksLeft > 0" @click="unlockRecord(r)" class="btn btn-xs btn-unlock" :disabled="unlockingId === r.id">
            {{ unlockingId === r.id ? '解锁中...' : '解锁' }}
          </button>
          <span v-else class="unlock-exhausted">今日用完</span>
        </span>
      </div>
    </div>

    <div class="empty" v-else-if="!loading">
      <p>暂无数据</p>
    </div>

    <div class="pagination" v-if="total > limit">
      <button @click="page--" :disabled="page <= 1" class="btn btn-ghost btn-sm">上一页</button>
      <span class="mono">{{ page }} / {{ Math.ceil(total / limit) }}</span>
      <button @click="page++" :disabled="page >= Math.ceil(total / limit)" class="btn btn-ghost btn-sm">下一页</button>
    </div>

    <div class="loading" v-if="loading">加载中...</div>

    <!-- 批量删除确认弹窗 -->
    <div class="modal-overlay" v-if="showDeleteConfirm" @click.self="showDeleteConfirm = false">
      <div class="modal-box">
        <h3>确认删除</h3>
        <p>确定要删除选中的 <strong>{{ selectedIds.size }}</strong> 条记录吗？此操作不可恢复。</p>
        <div class="modal-actions">
          <button @click="showDeleteConfirm = false" class="btn btn-ghost btn-sm">取消</button>
          <button @click="batchDelete" class="btn btn-danger btn-sm" :disabled="deleting">
            {{ deleting ? `删除中 (${deletedCount}/${selectedIds.size})` : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/stores/auth'

const auth = useAuthStore()
const records = ref([])
const loading = ref(false)
const dateFilter = ref(new Date().toISOString().split('T')[0])
const leagueFilter = ref('')
const page = ref(1)
const limit = 30
const total = ref(0)

// 批量选择
const selectedIds = ref(new Set())
const selectedIdsArr = ref([])
const showDeleteConfirm = ref(false)
const deleting = ref(false)
const deletedCount = ref(0)

// 解锁
const dailyUnlocksLeft = ref(3)
const unlockingId = ref('')
const unlockMsg = ref({ type: 'info', text: '' })

function showMsg(type, text) { unlockMsg.value = { type, text }; setTimeout(() => { unlockMsg.value.text = '' }, 5000) }
function syncSelected() { selectedIds.value = new Set(selectedIdsArr.value) }
function selectAll() { selectedIdsArr.value = records.value.map(r => r.id); selectedIds.value = new Set(selectedIdsArr.value) }
function deselectAll() { selectedIdsArr.value = []; selectedIds.value = new Set() }

async function batchDelete() {
  deleting.value = true; deletedCount.value = 0
  const ids = [...selectedIds.value]
  for (const id of ids) {
    try { await api.delete(`/admin/sweep/${id}`); deletedCount.value++ } catch (e) { console.error('删除失败', id) }
  }
  deleting.value = false; showDeleteConfirm.value = false; deselectAll(); await loadData()
}
function confirmBatchDelete() { showDeleteConfirm.value = true }

async function unlockRecord(r) {
  if (dailyUnlocksLeft.value <= 0) { showMsg('error', '今日解锁次数已用完'); return }
  unlockingId.value = r.id
  try {
    const { data } = await api.post(`/purchases/unlock/${r.id}`)
    dailyUnlocksLeft.value = data.unlocksLeft
    showMsg('success', `✅ 解锁成功！今日剩余 ${data.unlocksLeft} 次`)
    await loadData()
  } catch (e) { showMsg('error', '解锁失败：' + (e.response?.data?.error || e.message)) }
  finally { unlockingId.value = '' }
}

const playLabelMap = { win_draw_loss: '胜平负', handicap: '让球', score: '比分', goals: '进球', half_full: '半全' }
function playLabel(key) { return playLabelMap[key] || key }

function parsePlays(handicapStr) {
  if (!handicapStr) return []
  let v
  try { v = JSON.parse(handicapStr) } catch (e) { return [] }
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    // 把 { win_draw_loss: {pick,result}, ... } 转成 [{key, pick, result}]
    return Object.entries(v).map(([key, val]) => ({
      key, pick: val?.pick ?? val, result: val?.result ?? 'pending'
    }))
  }
  return []
}

function tierTag(t) { return { free: '🆓', monthly: '💎', yearly: '👑' }[t] || t }
function resultLabel(r) { return { win: '✅红', loss: '❌黑', push: '🔄走', pending: '⏳待定' }[r] || '-' }
function resultDot(r) { return { win: '✅', loss: '❌', push: '🔄', pending: '⏳' }[r] || '-' }
function formatTime(t) { if (!t) return '-'; return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }

async function loadData() {
  loading.value = true
  try {
    const params = { page: page.value, limit, date: dateFilter.value, league: leagueFilter.value }
    const { data } = await api.get('/sweep', { params })
    records.value = data.records
    total.value = data.total
    if (auth.isLoggedIn && auth.tier === 'free') {
      const unlockRes = await api.get('/purchases/unlocks-left').catch(() => ({ data: { left: 0 } }))
      dailyUnlocksLeft.value = unlockRes.data?.left ?? 0
    }
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

let timer
function debouncedLoad() { clearTimeout(timer); timer = setTimeout(loadData, 400) }

watch(selectedIdsArr, syncSelected)
onMounted(loadData)
</script>

<style scoped>
.page { max-width: 1400px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.filters { display: flex; gap: 12px; margin-bottom: 24px; align-items: center; flex-wrap: wrap; }
.filter-input { padding: 8px 12px; background: #161B22; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; }
.divider-v { width: 1px; height: 20px; background: #30363D; }
.unlock-tip { font-size: 12px; color: #F0883E; margin-left: 4px; }
.unlock-desc { color: #8B949E; margin-left: 4px; }

.msg { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
.msg.success { background: rgba(63,185,80,0.12); border: 1px solid rgba(63,185,80,0.3); color: #3FB950; }
.msg.error { background: rgba(248,81,73,0.12); border: 1px solid rgba(248,81,73,0.3); color: #F85149; }
.msg-close { background: none; border: none; color: inherit; cursor: pointer; font-size: 18px; padding: 0 4px; }

.records-table { background: #161B22; border: 1px solid #21262D; border-radius: 12px; overflow: hidden; }
.table-header, .table-row { display: grid; gap: 12px; padding: 12px 16px; align-items: center; font-size: 13px; }
.table-header { background: #21262D; border-radius: 8px 8px 0 0; color: #8B949E; font-size: 12px; font-weight: 600; }
.table-row { border-bottom: 1px solid #21262D; transition: background 0.15s; }
.table-row:hover { background: #161B22; }
.table-row.selected { background: rgba(88,166,255,0.06); }
.table-row:last-child { border-radius: 0 0 8px 8px; }

/* 管理员列 */
.table-header { grid-template-columns: 32px 80px 1fr 1fr 130px 2fr 90px 60px 70px; }
.table-row { grid-template-columns: 32px 80px 1fr 1fr 130px 2fr 90px 60px 70px; }
.table-header.vip, .table-row.vip { grid-template-columns: 32px 80px 1fr 1fr 130px 2fr 90px 60px 70px 80px; }
.check-cell { display: flex; justify-content: center; }

.league-tag { font-size: 11px; color: #58A6FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plays { display: flex; flex-direction: column; gap: 4px; }
.play-line { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 2px 6px; border-radius: 4px; background: rgba(33,38,45,0.5); }
.play-line.win { background: rgba(63,185,80,0.1); }
.play-line.loss { background: rgba(248,81,73,0.1); }
.play-line.push { background: rgba(139,148,158,0.1); }
.play-line.pending { background: rgba(240,136,62,0.08); }
.play-label { color: #8B949E; min-width: 36px; font-weight: 600; }
.play-pick { color: #E6EDF3; flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.play-result { font-size: 12px; min-width: 16px; text-align: center; }
.locked { justify-content: center; }
.lock-msg { display: flex; align-items: center; gap: 6px; color: #8B949E; font-size: 12px; justify-content: center; padding: 6px; }
.lock-icon { font-size: 14px; }

.stars { display: flex; gap: 1px; }
.star { color: #30363D; font-size: 11px; }
.star.active { color: #F0883E; }
.tier-tag { font-size: 14px; }
.result-tag { font-size: 12px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-align: center; }
.result-tag.win { color: #3FB950; }
.result-tag.loss { color: #F85149; }
.result-tag.push { color: #8B949E; }
.result-tag.pending { color: #F0883E; }

/* 解锁操作列 */
.unlock-cell { display: flex; justify-content: center; }
.btn-xs { padding: 3px 8px; font-size: 11px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; }
.btn-unlock { background: #58A6FF; color: #0D1117; }
.btn-unlock:hover { background: #79b8ff; }
.btn-unlock:disabled { opacity: 0.5; cursor: not-allowed; }
.unlock-exhausted { font-size: 11px; color: #8B949E; }

.pagination { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 24px; }
.loading, .empty { text-align: center; color: #8B949E; padding: 40px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-box { background: #161B22; border: 1px solid #30363D; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; }
.modal-box h3 { font-size: 18px; margin-bottom: 12px; }
.modal-box p { color: #8B949E; font-size: 14px; margin-bottom: 24px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }

.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; text-decoration: none; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.btn-danger { background: #F85149; color: white; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.badge { background: rgba(248,81,73,0.2); color: #F85149; border-radius: 10px; padding: 1px 6px; font-size: 11px; margin-left: 4px; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
