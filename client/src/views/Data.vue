<template>
  <div class="page">
    <div class="page-header">
      <h1>📊 扫盘数据</h1>
      <p>每日更新全部赛事扫盘记录，付费用户可查看完整赔率和信心分析</p>
    </div>

    <div class="filters">
      <input v-model="dateFilter" type="date" class="filter-input" @change="loadData" />
      <input v-model="leagueFilter" type="text" placeholder="搜索联赛..." class="filter-input" @input="debouncedLoad" />
      <button @click="loadData" class="btn btn-primary btn-sm">刷新</button>
      <router-link to="/admin/upload" v-if="auth.isAdmin" class="btn btn-ghost btn-sm">上传数据</router-link>
    </div>

    <div class="records-table" v-if="records.length">
      <div class="table-header">
        <span>联赛</span><span>主队</span><span>客队</span><span>时间</span>
        <span>玩法推荐</span><span>信心</span><span>权限</span><span>结果</span>
      </div>
      <div class="table-row" v-for="r in records" :key="r.id">
        <span class="league-tag">{{ r.league }}</span>
        <span>{{ r.home_team }}</span>
        <span>{{ r.away_team }}</span>
        <span class="mono">{{ formatTime(r.match_time) }}</span>
        <div class="plays">
          <div v-for="(p, key) in parsePlays(r.handicap)" :key="key" class="play-line" :class="p.result">
            <span class="play-label">{{ playLabel(key) }}</span>
            <span class="play-pick">{{ p.pick || '-' }}</span>
            <span class="play-result">{{ resultDot(p.result) }}</span>
          </div>
        </div>
        <span class="stars">
          <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= (r.confidence_stars || 0) }">★</span>
        </span>
        <span class="tier-tag" :class="r.tier_required">{{ tierTag(r.tier_required) }}</span>
        <span class="result-tag" :class="r.result">{{ resultLabel(r.result) }}</span>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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

const playLabelMap = {
  win_draw_loss: '胜平负',
  handicap: '让球',
  score: '比分',
  goals: '进球',
  half_full: '半全'
}

function playLabel(key) { return playLabelMap[key] || key }

function parsePlays(handicapStr) {
  if (!handicapStr) return {}
  let v
  try { v = JSON.parse(handicapStr) } catch (e) { v = handicapStr }
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
  return { handicap: { pick: String(v), result: 'pending' } }
}

function tierTag(t) {
  return { free: '🆓', monthly: '💎', yearly: '👑' }[t] || t
}
function resultLabel(r) {
  return { win: '✅红', loss: '❌黑', push: '🔄走', pending: '⏳待定' }[r] || '-'
}
function resultDot(r) {
  return { win: '✅', loss: '❌', push: '🔄', pending: '⏳' }[r] || '-'
}
function formatTime(t) {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadData() {
  loading.value = true
  try {
    const params = { page: page.value, limit, date: dateFilter.value, league: leagueFilter.value }
    const { data } = await api.get('/sweep', { params })
    records.value = data.records
    total.value = data.total
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

let timer
function debouncedLoad() { clearTimeout(timer); timer = setTimeout(loadData, 400) }

onMounted(loadData)
</script>

<style scoped>
.page { max-width: 1300px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.filters { display: flex; gap: 12px; margin-bottom: 24px; align-items: center; flex-wrap: wrap; }
.filter-input { padding: 8px 12px; background: #161B22; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; }
.table-header, .table-row {
  display: grid;
  grid-template-columns: 80px 1fr 1fr 130px 2fr 90px 60px 70px;
  gap: 12px;
  padding: 12px 16px;
  align-items: center;
  font-size: 13px;
}
.table-header { background: #161B22; border-radius: 8px 8px 0 0; color: #8B949E; font-size: 12px; font-weight: 600; border-bottom: 1px solid #21262D; }
.table-row { border-bottom: 1px solid #21262D; transition: background 0.15s; }
.table-row:hover { background: #161B22; }
.table-row:last-child { border-radius: 0 0 8px 8px; }
.league-tag { font-size: 11px; color: #58A6FF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 玩法列 */
.plays { display: flex; flex-direction: column; gap: 4px; }
.play-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(33, 38, 45, 0.5);
}
.play-line.win { background: rgba(63, 185, 80, 0.1); }
.play-line.loss { background: rgba(248, 81, 73, 0.1); }
.play-line.push { background: rgba(139, 148, 158, 0.1); }
.play-line.pending { background: rgba(240, 136, 62, 0.08); }
.play-label { color: #8B949E; min-width: 36px; font-weight: 600; }
.play-pick { color: #E6EDF3; flex: 1; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.play-result { font-size: 12px; min-width: 16px; text-align: center; }

.stars { display: flex; gap: 1px; }
.star { color: #30363D; font-size: 11px; }
.star.active { color: #F0883E; }
.tier-tag { font-size: 14px; }
.result-tag { font-size: 12px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-align: center; }
.result-tag.win { color: #3FB950; }
.result-tag.loss { color: #F85149; }
.result-tag.push { color: #8B949E; }
.result-tag.pending { color: #F0883E; }

.pagination { display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 24px; }
.loading, .empty { text-align: center; color: #8B949E; padding: 40px; }
.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; text-decoration: none; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>