<template>
  <div class="page">
    <div class="page-header">
      <h1>📊 扫盘数据</h1>
      <p>付费用户可查看完整赔率和信心分析</p>
    </div>

    <div class="filters">
      <button @click="loadData" class="btn btn-primary btn-sm">刷新</button>
      <router-link to="/admin/upload" v-if="auth.isAdmin" class="btn btn-ghost btn-sm">上传数据</router-link>
      <!-- 管理员批量操作 -->
      <template v-if="auth.isAdmin">
        <span class="divider-v"></span>
        <button @click="selectAll" class="btn btn-ghost btn-sm">全选</button>
        <button @click="deselectAll" class="btn btn-ghost btn-sm">反选</button>
      </template>
      <span class="divider-v"></span>
      <!-- 辅助筛选：默认收起，手机点击展开 -->
      <button class="btn btn-ghost btn-sm" @click="showFilters = !showFilters">
        🔍 筛选 {{ (dateFilter || leagueFilter || weekdayFilter) ? '·' : '' }}
      </button>
    </div>
    <div class="filters filters-advanced" v-show="showFilters">
      <input v-model="leagueFilter" type="text" placeholder="搜索联赛..." class="filter-input" @input="onFilterChange" />
      <div class="filter-weekday-tabs">
        <button v-for="d in weekdays" :key="d.value" :class="{ active: weekdayFilter === d.value }"
          @click="weekdayFilter = weekdayFilter === d.value ? null : d.value; page = 1; loadData()">{{ d.label }}</button>
      </div>
      <div class="filter-date-wrap">
        <input v-model="dateFilter" type="date" class="filter-input" @change="page = 1; loadData()" title="按上传日期筛选" />
        <button v-if="dateFilter" @click="dateFilter = ''; loadData()" class="clear-btn" title="清除日期">✕</button>
      </div>
      <button v-if="dateFilter || leagueFilter || weekdayFilter" @click="page = 1; clearAllFilters()" class="btn btn-ghost btn-sm clear-all">✕ 清除全部</button>
    </div>
    <div class="filters" v-show="selectedIds.size > 0 || (auth.isLoggedIn && auth.tier === 'free')">
      <template v-if="auth.isAdmin">
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
        <span>场次</span><span>联赛</span><span>主队</span><span>客队</span><span>时间</span>
        <span>玩法推荐</span><span>信心</span><span>权限</span><span>结果</span>
        <span v-if="auth.isLoggedIn && auth.tier === 'free'">操作</span>
      </div>
      <div class="table-row" :class="{ selected: selectedIds.has(r.id) }" v-for="r in records" :key="r.id">
        <span class="check-cell" v-if="auth.isAdmin">
          <input type="checkbox" :value="r.id" v-model="selectedIdsArr" />
        </span>
        <span class="mono match-no-cell">{{ weekdayShort(r.weekday) }}{{ r.match_no }}
          <span v-if="r.category" class="cat-tag" :class="catClass(r.category)">{{ r.category }}</span>
        </span>
        <span class="league-tag league-cell">{{ r.league }}</span>
        <span class="home-team">{{ r.home_team }}</span>
        <span class="away-team">{{ r.away_team }}</span>
        <span class="mono time-cell">{{ formatTime(r.match_time) }}</span>

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

        <span class="stars stars-cell">
          <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= (r.confidence_stars || 0) }">★</span>
        </span>
        <span class="tier-tag tier-cell" :class="r.tier_required">{{ tierTag(r.tier_required) }}</span>
        <span class="result-tag result-cell" :class="r.result">{{ resultLabel(r.result) }}
          <a v-if="r.detail_url && isMember" :href="r.detail_url" target="_blank" class="detail-link">📋 详情</a>
          <span v-else-if="r.detail_url" class="detail-locked" title="会员专享">🔒 详情</span>
        </span>

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
      <button @click="page > 1 && (page--, loadData())" :disabled="page <= 1" class="btn btn-ghost btn-sm">上一页</button>
      <span class="mono">{{ page }} / {{ Math.ceil(total / limit) }}</span>
      <button @click="page < Math.ceil(total / limit) && (page++, loadData())" :disabled="page >= Math.ceil(total / limit)" class="btn btn-ghost btn-sm">下一页</button>
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
const dateFilter = ref('')
const leagueFilter = ref('')
const weekdayFilter = ref(null)
const showFilters = ref(false)
function clearAllFilters() { dateFilter.value = ''; leagueFilter.value = ''; weekdayFilter.value = null; loadData() }
const weekdays = [{value:1,label:'周一'},{value:2,label:'周二'},{value:3,label:'周三'},{value:4,label:'周四'},{value:5,label:'周五'},{value:6,label:'周六'},{value:7,label:'周日'}]
// 会员（月/年）可见详情页链接
const isMember = auth.tier === 'monthly' || auth.tier === 'yearly'
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
const unlockedIds = ref([])
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
    // 乐观更新本地状态：立即把该 ID 加入已解锁集合，不等后端 loadData 回来
    if (data.unlockedId && !unlockedIds.value.includes(data.unlockedId)) {
      unlockedIds.value.push(data.unlockedId)
    }
    // 重新拉数据（后端会返回完整 fields + 最新 unlockedIds）
    await loadData()
    showMsg('success', `✅ 解锁成功！今日剩余 ${data.unlocksLeft} 次`)
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
function catClass(c) { return { '人工扫盘': 'cat-manual', 'AI扫盘': 'cat-ai', '大神扫盘': 'cat-god' }[c] || 'cat-other' }
function resultLabel(r) { return { win: '✅红', loss: '❌黑', push: '🔄走', pending: '⏳待定' }[r] || '-' }
function resultDot(r) { return { win: '✅', loss: '❌', push: '🔄', pending: '⏳' }[r] || '-' }
function formatTime(t) { if (!t) return '-'; return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function weekdayShort(w) { return {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'}[w]||'' }

async function loadData() {
  loading.value = true
  try {
    const params = { page: page.value, limit, date: dateFilter.value, league: leagueFilter.value }
    if (weekdayFilter.value) params.weekday = weekdayFilter.value
    const { data } = await api.get('/sweep', { params })
    records.value = data.records
    total.value = data.total
    // 后端返回的 unlockedIds 代表本用户已解锁的扫盘 ID 集合（即使是免费用户也能看到完整字段）
    unlockedIds.value = data.unlockedIds || []
    if (auth.isLoggedIn && auth.tier === 'free') {
      const unlockRes = await api.get('/purchases/unlocks-left').catch(() => ({ data: { left: 0 } }))
      dailyUnlocksLeft.value = unlockRes.data?.left ?? 0
    }
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

let timer
function debouncedLoad() { clearTimeout(timer); timer = setTimeout(loadData, 400) }
function onFilterChange() { page.value = 1; debouncedLoad() }

watch(selectedIdsArr, syncSelected)
onMounted(loadData)
</script>

<style scoped>
.page { max-width: 1400px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.filters { display: flex; gap: 12px; margin-bottom: 24px; align-items: center; flex-wrap: wrap; }
.filters-advanced { margin-top: -12px; padding: 12px 14px; background: rgba(22,27,34,0.4); border: 1px solid #21262D; border-radius: 8px; }
.filter-input { padding: 8px 12px; background: #161B22; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; }
.filter-date-wrap { position: relative; display: flex; align-items: center; gap: 6px; }
.filter-date-wrap .filter-input { padding-right: 36px; }
.filter-date-wrap .clear-btn { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; padding: 0; line-height: 1; }
.filter-weekday-tabs { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; scrollbar-width: none; }
.filter-weekday-tabs::-webkit-scrollbar { display: none; }
.filter-weekday-tabs button { flex-shrink: 0; padding: 6px 10px; background: #161B22; border: 1px solid #30363D; border-radius: 6px; color: #8B949E; font-size: 13px; cursor: pointer; white-space: nowrap; }
.filter-weekday-tabs button.active { background: #1F6FEB; border-color: #1F6FEB; color: #fff; }
.clear-all { color: #F85149; border-color: #F85149; }
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

/* 表格列：场次 | 联赛 | 主队 | 客队 | 时间 | 玩法推荐 | 信心 | 权限 | 结果 */
.table-header { grid-template-columns: 32px 80px 1fr 1fr 130px 110px 2fr 70px 60px 70px; }
.table-row { grid-template-columns: 32px 80px 1fr 1fr 130px 110px 2fr 70px 60px 70px; }
.table-header.vip, .table-row.vip { grid-template-columns: 32px 80px 1fr 1fr 130px 110px 2fr 70px 60px 70px 80px; }
.check-cell { display: flex; justify-content: center; }

.league-tag { font-size: 11px; color: #58A6FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plays { display: flex; flex-direction: column; gap: 4px; align-self: start; }
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
.cat-tag { display: block; font-size: 10px; margin-top: 2px; padding: 1px 4px; border-radius: 3px; text-align: center; font-weight: 600; }
.cat-manual { background: rgba(88,166,255,0.15); color: #58A6FF; }
.cat-ai { background: rgba(163,113,247,0.15); color: #A371F7; }
.cat-god { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.cat-other { background: rgba(139,148,158,0.15); color: #8B949E; }
.result-tag { font-size: 12px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-align: center; }
.detail-link { display: inline-block; margin-top: 4px; font-size: 11px; color: #58A6FF; text-decoration: underline; text-underline-offset: 2px; }
.detail-locked { display: inline-block; margin-top: 4px; font-size: 11px; color: #8B949E; }
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

/* 手机竖屏：表格转卡片布局（放在末尾以保证样式优先级） */
@media (max-width: 768px) {
  .records-table { background: transparent; border: none; }
  .table-header { display: none; }
  .table-row {
    display: flex; flex-direction: column; gap: 10px;
    padding: 14px; margin-bottom: 12px;
    background: #161B22; border: 1px solid #21262D; border-radius: 12px;
  }
  .table-row > .check-cell { order: -1; align-self: flex-start; }
  .table-row > .match-no-cell { order: 0; font-weight: 700; font-size: 15px; }
  .table-row > .league-cell { order: 1; font-size: 12px; color: #58A6FF; }
  .table-row > .home-team, .table-row > .away-team { order: 2; font-size: 16px; }
  .table-row > .time-cell { order: 3; color: #8B949E; font-size: 12px; }
  .table-row > .plays { order: 4; width: 100%; }
  .table-row > .stars-cell { order: 5; }
  .table-row > .tier-cell { order: 5; }
  .table-row > .result-cell { order: 6; }
  .table-row > .unlock-cell { order: 7; }
  .table-row.selected { background: rgba(88,166,255,0.08); border-color: rgba(88,166,255,0.3); }
}
</style>
