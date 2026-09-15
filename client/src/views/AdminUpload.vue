<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>📤 扫盘数据管理</h1>
      <p>所有扫盘数据先保存为草稿，确认后点击"发布"逐条上线。已发布后仍可点击修改并记录变更时间</p>
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="showCreate = !showCreate" class="btn btn-primary">{{ showCreate ? '✕ 收起' : '✏️ 新增扫盘数据' }}</button>
      <button v-if="selectedIds.length" @click="batchPublish" class="btn btn-success">批量发布 ({{ selectedIds.length }})</button>
      <button v-if="selectedIds.length" @click="batchDelete" class="btn btn-ghost danger">批量删除</button>
      <div class="filter-tabs">
        <button :class="{ active: filter === 'all' }" @click="filter = 'all'; loadRecords()">全部 ({{ counts.all }})</button>
        <button :class="{ active: filter === 'pending' }" @click="filter = 'pending'; loadRecords()">📝 草稿 ({{ counts.pending }})</button>
        <button :class="{ active: filter === 'published' }" @click="filter = 'published'; loadRecords()">✅ 已发布 ({{ counts.published }})</button>
        <button :class="{ active: filter === 'settled' }" @click="filter = 'settled'; loadRecords()">🏁 已结算 ({{ counts.settled }})</button>
      </div>
    </div>

    <!-- 表格批量上传 -->
    <div class="upload-card sheet-card">
      <div class="sheet-head">
        <h3>📊 表格批量上传（支持 Excel / CSV / JSON）</h3>
        <button @click="downloadTemplate" class="btn btn-ghost btn-sm">⬇️ 下载模板</button>
      </div>
      <p class="sheet-tip">下载模板后在「扫盘数据」工作表填写每日比赛，表头自动识别（联赛/主队/客队/比赛时间/周几/场次/各玩法推荐/结果）。上传后可直接发布或存为草稿。</p>
      <div class="sheet-row">
        <input ref="uploadInput" type="file" accept=".xlsx,.xls,.csv,.json" @change="onFileChange" class="file-input" />
        <label class="publish-toggle">
          <input type="checkbox" v-model="autoPublish" /> 上传后直接发布
        </label>
        <button @click="handleUpload" class="btn btn-primary" :disabled="uploading || !uploadFile">
          {{ uploading ? '上传中...' : '📤 上传并导入' }}
        </button>
        <span v-if="uploadFile" class="file-name">已选：{{ uploadFile.name }}</span>
      </div>
      <div v-if="uploadResult" class="result-msg" :class="uploadResult.error ? 'error' : 'success'">
        {{ uploadResult.text }}
        <ul v-if="uploadResult.errors && uploadResult.errors.length" class="err-list">
          <li v-for="(e, i) in uploadResult.errors" :key="i">⚠️ {{ e }}</li>
        </ul>
      </div>
    </div>

    <!-- 新增表单 -->
    <div v-if="showCreate" class="upload-card">
      <h3>新增扫盘草稿</h3>
      <div class="form-row">
        <div class="form-group"><label>联赛</label><input v-model="form.league" required placeholder="如：英超" /></div>
        <div class="form-group"><label>主队</label><input v-model="form.home_team" required /></div>
        <div class="form-group"><label>客队</label><input v-model="form.away_team" required /></div>
        <div class="form-group"><label>比赛时间</label><input v-model="form.match_time" type="datetime-local" required /></div>
        <div class="form-group"><label>场次编号</label>
          <div style="display:flex;gap:8px;align-items:center">
            <select v-model.number="form.weekday" style="width:120px">
              <option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
            <input v-model="form.match_no" placeholder="如 001" maxlength="4" style="width:80px" />
          </div>
        </div>
        <div class="form-group"><label>信心星级</label>
          <select v-model.number="form.confidence_stars">
            <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}{{ '☆'.repeat(5-n) }}</option>
          </select>
        </div>
        <div class="form-group"><label>权限</label>
          <select v-model="form.tier_required">
            <option value="free">🆓 免费</option><option value="monthly">💎 月度</option><option value="yearly">👑 年度</option>
          </select>
        </div>
      </div>
      <div class="block-title">各玩法结果</div>
      <div class="plays-grid">
        <div class="play-item" v-for="play in playTypes" :key="play.key">
          <div class="play-head"><span class="play-name">{{ play.label }}</span><span class="play-tag">{{ play.tag }}</span></div>
          <div class="play-body">
            <div class="form-group compact"><label>推荐</label><input v-model="form.plays[play.key].pick" :placeholder="play.placeholder" /></div>
            <div class="form-group compact"><label>结果</label>
              <select v-model="form.plays[play.key].result">
                <option value="pending">⏳ 待定</option><option value="win">✅ 红</option><option value="loss">❌ 黑</option><option value="push">🔄 走</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div v-if="submitMsg" class="result-msg" :class="submitMsg.error ? 'error' : 'success'">{{ submitMsg.text }}</div>
      <button @click="submitDraft" class="btn btn-primary" :disabled="submitting">{{ submitting ? '保存中...' : '💾 保存为草稿' }}</button>
    </div>

    <!-- 数据列表 -->
    <div class="records-list" v-if="records.length">
      <div class="list-item" v-for="r in records" :key="r.id">
        <input type="checkbox" :value="r.id" v-model="selectedIds" class="checkbox" />
        <div class="item-main">
          <div class="item-top">
            <span class="league-tag">{{ r.league }}</span>
            <span class="match-teams">{{ r.home_team }} VS {{ r.away_team }}</span>
            <span class="mono time">{{ formatTime(r.match_time) }}</span>
            <span class="weekday-badge">{{ weekdayLabel(r.weekday) }} {{ r.match_no }}</span>
            <span class="tier-tag" :class="r.tier_required">{{ tierTag(r.tier_required) }}</span>
            <span class="stars">
              <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= (r.confidence_stars || 0) }">★</span>
            </span>
            <span class="status-badge" :class="r.status">{{ statusLabel(r.status) }}</span>
          </div>
          <div class="item-plays">
            <div v-for="(p, key) in parsePlays(r.handicap)" :key="key" class="play-line" :class="p.result">
              <span class="play-label">{{ playLabel(key) }}</span>
              <span class="play-pick">{{ p.pick || '-' }}</span>
              <span class="play-result">{{ resultDot(p.result) }}</span>
            </div>
          </div>
          <div class="item-meta">
            <span class="mono">⏱ 创建: {{ formatDate(r.created_at) }}</span>
            <span class="mono">✏️ 更新: {{ formatDate(r.updated_at) }}</span>
            <span v-if="r.published_at" class="mono published-at">📤 发布: {{ formatDate(r.published_at) }}</span>
          </div>
        </div>
        <div class="item-actions">
          <button v-if="r.status === 'pending'" @click="publish(r.id)" class="btn btn-success btn-sm">📤 发布</button>
          <button v-else-if="r.status === 'published' || r.status === 'settled'" @click="unpublish(r.id)" class="btn btn-ghost btn-sm">↩️ 撤回</button>
          <button @click="editRecord(r)" class="btn btn-ghost btn-sm">✏️ 修改</button>
          <button @click="removeRecord(r.id)" class="btn btn-ghost btn-sm danger">删除</button>
        </div>
      </div>
    </div>
    <div v-else class="empty">暂无扫盘数据</div>

    <!-- 编辑弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal modal-large">
        <h3>修改扫盘数据 <span class="modal-hint">（修改时间会自动记录）</span></h3>
        <div class="form-row">
          <div class="form-group"><label>联赛</label><input v-model="editForm.league" /></div>
          <div class="form-group"><label>主队</label><input v-model="editForm.home_team" /></div>
          <div class="form-group"><label>客队</label><input v-model="editForm.away_team" /></div>
          <div class="form-group"><label>比赛时间</label><input v-model="editForm.match_time" type="datetime-local" /></div>
          <div class="form-group"><label>场次编号</label>
            <div style="display:flex;gap:8px;align-items:center">
              <select v-model.number="editForm.weekday" style="width:120px">
                <option v-for="d in weekdays" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
              <input v-model="editForm.match_no" placeholder="如 001" maxlength="4" style="width:80px" />
            </div>
          </div>
          <div class="form-group"><label>信心星级</label>
            <select v-model.number="editForm.confidence_stars">
              <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}{{ '☆'.repeat(5-n) }}</option>
            </select>
          </div>
          <div class="form-group"><label>权限</label>
            <select v-model="editForm.tier_required">
              <option value="free">🆓 免费</option><option value="monthly">💎 月度</option><option value="yearly">👑 年度</option>
            </select>
          </div>
        </div>
        <div class="block-title">各玩法结果</div>
        <div class="plays-grid">
          <div class="play-item" v-for="play in playTypes" :key="play.key">
            <div class="play-head"><span class="play-name">{{ play.label }}</span></div>
            <div class="play-body">
              <div class="form-group compact"><label>推荐</label><input v-model="editForm.plays[play.key].pick" /></div>
              <div class="form-group compact"><label>结果</label>
                <select v-model="editForm.plays[play.key].result">
                  <option value="pending">⏳ 待定</option><option value="win">✅ 红</option><option value="loss">❌ 黑</option><option value="push">🔄 走</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="saveEdit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '💾 保存修改' }}</button>
          <button @click="editing = null" class="btn btn-ghost">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'

const records = ref([])
const filter = ref('all')
const counts = ref({ all: 0, pending: 0, published: 0, settled: 0 })
const selectedIds = ref([])
const showCreate = ref(false)
const submitting = ref(false)
const submitMsg = ref(null)

const playTypes = [
  { key: 'win_draw_loss', label: '胜平负', tag: '主胜/平/客胜', placeholder: '如：主胜' },
  { key: 'handicap', label: '让球', tag: '让球+结果', placeholder: '如：主-1 胜' },
  { key: 'score', label: '比分', tag: '精确比分', placeholder: '如：2:1' },
  { key: 'goals', label: '进球', tag: '总进球', placeholder: '如：3球' },
  { key: 'half_full', label: '半全', tag: '半场/全场', placeholder: '如：平/胜' },
]
const weekdays = [
  { value: 1, label: '周一' }, { value: 2, label: '周二' },
  { value: 3, label: '周三' }, { value: 4, label: '周四' },
  { value: 5, label: '周五' }, { value: 6, label: '周六' }, { value: 7, label: '周日' },
]

function emptyPlays() {
  const obj = {}; playTypes.forEach(p => { obj[p.key] = { pick: '', result: 'pending' } }); return obj
}

const form = ref({
  league: '', home_team: '', away_team: '', match_time: '',
  confidence_stars: 3, tier_required: 'free', plays: emptyPlays(),
  weekday: 1, match_no: ''
})

const editing = ref(null)
const saving = ref(false)
const editForm = ref({ league: '', home_team: '', away_team: '', match_time: '', confidence_stars: 3, tier_required: 'free', plays: emptyPlays(), weekday: 1, match_no: '' })

function tierTag(t) { return { free: '🆓', monthly: '💎', yearly: '👑' }[t] || t }
function statusLabel(s) { return { pending: '📝 草稿', published: '✅ 已发布', settled: '🏁 已结算' }[s] || s }
function playLabel(k) { return { win_draw_loss: '胜平负', handicap: '让球', score: '比分', goals: '进球', half_full: '半全' }[k] || k }
function resultDot(r) { return { win: '✅', loss: '❌', push: '🔄', pending: '⏳' }[r] || '-' }
function parsePlays(h) {
  if (!h) return {}
  let v
  try { v = JSON.parse(h) } catch (e) { v = h }
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
  return { handicap: { pick: String(v), result: 'pending' } }
}
function formatTime(t) { if (!t) return '-'; return new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleString('zh-CN', { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }
function weekdayLabel(w) { return {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'}[w]||'' }

async function loadCounts() {
  try {
    for (const s of ['all', 'pending', 'published', 'settled']) {
      const { data } = await api.get('/admin/sweep', { params: { status: s === 'all' ? undefined : s, limit: 1 } })
      counts.value[s] = data.total
    }
  } catch (e) { console.error(e) }
}

async function loadRecords() {
  try {
    const params = { limit: 100 }
    if (filter.value !== 'all') params.status = filter.value
    const { data } = await api.get('/admin/sweep', { params })
    records.value = data.records
    selectedIds.value = []
    await loadCounts()
  } catch (e) { console.error(e) }
}

async function submitDraft() {
  submitting.value = true; submitMsg.value = null
  try {
    const plays = form.value.plays
    const payload = {
      league: form.value.league, home_team: form.value.home_team, away_team: form.value.away_team,
      match_time: form.value.match_time, confidence_stars: form.value.confidence_stars,
      tier_required: form.value.tier_required, odds_type: 'multi',
      handicap: JSON.stringify(plays), odds: 0, result: 'pending',
      weekday: form.value.weekday, match_no: form.value.match_no
    }
    const settled = Object.values(plays).filter(p => p.result !== 'pending')
    if (settled.length > 0) {
      const wins = settled.filter(p => p.result === 'win').length
      const losses = settled.filter(p => p.result === 'loss').length
      if (wins > losses) payload.result = 'win'
      else if (losses > wins) payload.result = 'loss'
      else payload.result = 'push'
    }
    await api.post('/admin/sweep', payload)
    submitMsg.value = { text: '已保存为草稿，可点击"发布"上线', error: false }
    form.value = { league: '', home_team: '', away_team: '', match_time: '', confidence_stars: 3, tier_required: 'free', plays: emptyPlays(), weekday: 1, match_no: '' }
    await loadRecords()
  } catch (e) { submitMsg.value = { text: e.response?.data?.error || '保存失败', error: true } }
  finally { submitting.value = false }
}

async function publish(id) {
  if (!confirm('确认发布？发布后会员可查看。')) return
  try { await api.post(`/admin/sweep/${id}/publish`); await loadRecords() }
  catch (e) { alert('发布失败: ' + e.message) }
}

async function unpublish(id) {
  if (!confirm('撤回后会员将无法查看，确认？')) return
  try { await api.post(`/admin/sweep/${id}/unpublish`, {}); await loadRecords() }
  catch (e) { alert('撤回失败: ' + e.message) }
}

function editRecord(r) {
  editing.value = r.id
  const plays = parsePlays(r.handicap)
  const filled = emptyPlays()
  Object.keys(plays).forEach(k => { if (filled[k]) filled[k] = plays[k] })
  editForm.value = { league: r.league, home_team: r.home_team, away_team: r.away_team, match_time: r.match_time ? r.match_time.replace(' ', 'T').substring(0, 16) : '', confidence_stars: r.confidence_stars, tier_required: r.tier_required, plays: filled, weekday: r.weekday || 1, match_no: r.match_no || '' }
}

async function saveEdit() {
  saving.value = true
  try {
    const payload = { league: editForm.value.league, home_team: editForm.value.home_team, away_team: editForm.value.away_team, match_time: editForm.value.match_time, confidence_stars: editForm.value.confidence_stars, tier_required: editForm.value.tier_required, handicap: JSON.stringify(editForm.value.plays), result: 'pending', weekday: editForm.value.weekday, match_no: editForm.value.match_no }
    await api.put(`/admin/sweep/${editing.value}`, payload)
    editing.value = null
    await loadRecords()
  } catch (e) { alert('保存失败: ' + e.message) }
  finally { saving.value = false }
}

async function removeRecord(id) {
  if (!confirm('确认删除？此操作不可恢复。')) return
  try { await api.delete(`/admin/sweep/${id}`); await loadRecords() }
  catch (e) { alert('删除失败: ' + e.message) }
}

async function batchPublish() {
  if (!confirm(`确认发布选中的 ${selectedIds.value.length} 条数据？`)) return
  try { await api.post('/admin/sweep/batch-publish', { ids: selectedIds.value }); await loadRecords() }
  catch (e) { alert('批量发布失败: ' + e.message) }
}

async function batchDelete() {
  if (!confirm(`确认删除选中的 ${selectedIds.value.length} 条数据？`)) return
  for (const id of selectedIds.value) {
    try { await api.delete(`/admin/sweep/${id}`) } catch (e) {}
  }
  await loadRecords()
}

const uploadFile = ref(null)
const uploadInput = ref(null)
const autoPublish = ref(false)
const uploading = ref(false)
const uploadResult = ref(null)

function onFileChange(e) {
  const f = e.target.files && e.target.files[0]
  uploadFile.value = f || null
  uploadResult.value = null
}

async function downloadTemplate() {
  try {
    const { data } = await api.get('/admin/upload/template', { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url; a.download = 'sweep_template.xlsx'; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { alert('下载模板失败: ' + (e.response?.data?.error || e.message)) }
}

async function handleUpload() {
  if (!uploadFile.value) { uploadResult.value = { error: true, text: '请先选择 Excel / CSV / JSON 文件' }; return }
  uploading.value = true; uploadResult.value = null
  try {
    const fd = new FormData()
    fd.append('file', uploadFile.value)
    fd.append('publish', autoPublish.value ? '1' : '0')
    const { data } = await api.post('/admin/upload/sweep', fd)
    uploadResult.value = {
      error: false,
      text: `✅ ${data.message}`,
      errors: data.errors || [],
    }
    uploadFile.value = null
    if (uploadInput.value) uploadInput.value.value = ''
    await loadRecords()
  } catch (e) {
    uploadResult.value = { error: true, text: e.response?.data?.error || '上传失败' }
  } finally { uploading.value = false }
}

onMounted(loadRecords)
</script>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; margin-bottom: 24px; }

.action-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.filter-tabs { display: flex; gap: 4px; margin-left: auto; }
.filter-tabs button { padding: 6px 14px; border-radius: 6px; border: 1px solid #30363D; background: transparent; color: #8B949E; cursor: pointer; font-size: 13px; }
.filter-tabs button.active { background: #21262D; color: #58A6FF; border-color: #58A6FF; }

.upload-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.upload-card h3 { font-size: 15px; margin-bottom: 16px; }

.sheet-card { border-color: #1F6FEB44; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.sheet-tip { color: #8B949E; font-size: 13px; line-height: 1.6; margin: 8px 0 16px; }
.sheet-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.file-input { color: #C9D1D9; font-size: 13px; max-width: 280px; }
.publish-toggle { color: #C9D1D9; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.file-name { color: #58A6FF; font-size: 13px; }
.err-list { margin: 8px 0 0; padding-left: 18px; color: #F85149; font-size: 12px; }
.err-list li { margin: 2px 0; }

.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
.form-group label { font-size: 12px; color: #8B949E; }
.form-group input, .form-group select, .form-group textarea { padding: 9px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; font-family: inherit; }
.form-group.compact input, .form-group.compact select { padding: 7px 10px; font-size: 13px; }

.block-title { font-size: 13px; font-weight: 700; color: #E6EDF3; margin: 16px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #21262D; }

.plays-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.play-item { background: #0D1117; border: 1px solid #21262D; border-radius: 8px; padding: 10px 12px; }
.play-head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.play-name { font-size: 13px; font-weight: 700; color: #E6EDF3; }
.play-tag { font-size: 10px; color: #8B949E; }
.play-body { display: flex; gap: 8px; }
.play-body .form-group { flex: 1; margin-bottom: 0; }

.result-msg { padding: 12px; border-radius: 8px; font-size: 13px; margin: 12px 0; }
.result-msg.success { background: rgba(63,185,80,0.1); border: 1px solid #3FB950; color: #3FB950; }
.result-msg.error { background: rgba(248,81,73,0.1); border: 1px solid #F85149; color: #F85149; }

.records-list { display: flex; flex-direction: column; gap: 10px; }
.list-item { display: flex; gap: 16px; padding: 16px; background: #161B22; border: 1px solid #21262D; border-radius: 10px; align-items: flex-start; }
.list-item:hover { border-color: #30363D; }
.checkbox { margin-top: 12px; width: 16px; height: 16px; cursor: pointer; }
.item-main { flex: 1; }
.item-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
.league-tag { font-size: 11px; color: #58A6FF; font-weight: 600; }
.match-teams { font-size: 14px; font-weight: 600; }
.time { font-size: 12px; color: #8B949E; }
.stars { display: flex; gap: 1px; }
.star { color: #30363D; font-size: 12px; }
.star.active { color: #F0883E; }
.tier-tag { font-size: 13px; }

.status-badge { font-size: 11px; padding: 3px 10px; border-radius: 10px; font-weight: 500; margin-left: auto; }
.status-badge.pending { background: rgba(240,136,62,0.15); color: #F0883E; }
.status-badge.published { background: rgba(63,185,80,0.15); color: #3FB950; }
.status-badge.settled { background: rgba(88,166,255,0.15); color: #58A6FF; }

.item-plays { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.play-line { display: flex; gap: 6px; align-items: center; font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(33,38,45,0.5); }
.play-line.win { background: rgba(63,185,80,0.1); }
.play-line.loss { background: rgba(248,81,73,0.1); }
.play-line.push { background: rgba(139,148,158,0.1); }
.play-label { color: #8B949E; font-weight: 600; min-width: 32px; }
.play-pick { color: #E6EDF3; font-family: 'JetBrains Mono', monospace; }
.play-result { font-size: 11px; }

.item-meta { display: flex; gap: 16px; font-size: 11px; color: #8B949E; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid #21262D; }
.published-at { color: #3FB950; }

.item-actions { display: flex; flex-direction: column; gap: 6px; min-width: 90px; }

.empty { text-align: center; color: #8B949E; padding: 40px; }

.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.15s; }
.btn-sm { padding: 6px 10px; font-size: 12px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-success { background: #3FB950; color: #0D1117; }
.btn-primary:disabled, .btn-success:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { border-color: #58A6FF; color: #58A6FF; }
.btn-ghost.danger:hover { color: #F85149; border-color: #F85149; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #161B22; border: 1px solid #30363D; border-radius: 12px; padding: 24px; width: 90%; max-width: 500px; }
.modal-large { max-width: 700px; max-height: 90vh; overflow-y: auto; }
.modal h3 { font-size: 16px; margin-bottom: 16px; }
.modal-hint { font-size: 12px; color: #8B949E; font-weight: 400; }
.modal-actions { display: flex; gap: 12px; margin-top: 16px; }

.mono { font-family: 'JetBrains Mono', monospace; }
</style>