<template>
  <div class="page">
    <div class="page-header">
      <h1>🤖 AI 赛事分析</h1>
      <p>选择比赛并生成专业分析提示词，一键跳转至豆包 / 千问 / 元宝 / Kimi / DeepSeek 进行深度分析</p>
    </div>

    <!-- 扫盘数据选择 -->
    <div class="section-card">
      <h2 class="section-title">📋 选取比赛（从扫盘数据）</h2>
      <p class="section-tip">选择已录入的比赛，系统自动填充基本面数据；如无匹配可手动填写</p>

      <div class="filter-row">
        <select v-model="filterDate" class="filter-select">
          <option value="">全部日期</option>
          <option v-for="d in availableDates" :key="d" :value="d">{{ d }}</option>
        </select>
        <input v-model="filterText" placeholder="搜索球队名称..." class="filter-input" />
        <button @click="loadSweepRecords" class="btn btn-ghost btn-sm">🔍 搜索</button>
      </div>

      <div v-if="loadingRecords" class="loading">加载扫盘数据...</div>
      <div v-else class="records-list">
        <div v-for="r in filteredRecords" :key="r.id" class="record-row" :class="{ selected: selectedRecord && selectedRecord.id === r.id }" @click="selectRecord(r)">
          <div class="record-main">
            <span class="r-date mono">{{ formatDate(r.match_time) }}</span>
            <span class="r-teams">{{ r.home_team }} <span class="vs">VS</span> {{ r.away_team }}</span>
            <span class="r-league">{{ r.league }}</span>
            <span class="r-matchno">{{ weekdayShort(r.weekday) }}{{ r.match_no }}</span>
          </div>
          <div class="record-meta">
            <span v-if="r.result && r.result !== 'pending'" class="r-result" :class="r.result">{{ resultLabel(r.result) }}</span>
            <span v-if="r.category" class="r-cat">{{ r.category }}</span>
          </div>
          <div class="record-select-icon">{{ selectedRecord && selectedRecord.id === r.id ? '✅' : '○' }}</div>
        </div>
        <div v-if="filteredRecords.length === 0 && !loadingRecords" class="empty">暂无匹配数据，请尝试其他筛选条件</div>
      </div>
    </div>

    <!-- 手动补充信息 -->
    <div class="section-card" v-if="selectedRecord">
      <h2 class="section-title">✏️ 补充基本面数据 <span v-if="fetchingStats" class="loading-tag">⏳ 联网获取中...</span><span v-else-if="statsLoaded" class="loading-tag ok">✅ 数据已获取</span><span v-else-if="statsError" class="loading-tag warn">{{ statsError }}</span></h2>
      <p class="section-tip">选择比赛后自动联网获取积分/近况/交锋数据；如未能获取请手动填写。</p>

      <div class="form-section">
        <div class="form-row">
          <div class="form-group">
            <label>主队近6场战绩（格式：胜-平-负：1-3，0-0...）</label>
            <input v-model="form.home_form" placeholder="如：1-3，0-0，0-2，5-1，0-3" />
          </div>
          <div class="form-group">
            <label>客队近6场战绩</label>
            <input v-model="form.away_form" placeholder="如：3-1，1-2，3-2，0-0..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>主队场均进球</label>
            <input v-model="form.home_goals_per_game" placeholder="如：1.5" type="number" step="0.1" />
          </div>
          <div class="form-group">
            <label>主队场均失球</label>
            <input v-model="form.home_concede_per_game" placeholder="如：1.2" type="number" step="0.1" />
          </div>
          <div class="form-group">
            <label>客队场均进球</label>
            <input v-model="form.away_goals_per_game" placeholder="如：1.8" type="number" step="0.1" />
          </div>
          <div class="form-group">
            <label>客队场均失球</label>
            <input v-model="form.away_concede_per_game" placeholder="如：1.5" type="number" step="0.1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>主队积分</label>
            <input v-model="form.home_points" placeholder="如：14" type="number" />
          </div>
          <div class="form-group">
            <label>客队积分</label>
            <input v-model="form.away_points" placeholder="如：11" type="number" />
          </div>
          <div class="form-group">
            <label>主队主场表现</label>
            <input v-model="form.home_home_record" placeholder="如：4胜2平1负" />
          </div>
          <div class="form-group">
            <label>客队客场表现</label>
            <input v-model="form.away_away_record" placeholder="如：2胜1平4负" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>主队伤停信息</label>
            <input v-model="form.home_injuries" placeholder="如有重要伤停请填写，留空表示未获取" />
          </div>
          <div class="form-group">
            <label>客队伤停信息</label>
            <input v-model="form.away_injuries" placeholder="如有重要伤停请填写，留空表示未获取" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>历史交锋记录（近6场）</label>
            <textarea v-model="form.h2h" rows="3" placeholder="如：热刺2胜0平4负，最近：2026-05-04 热刺2-1维拉..."></textarea>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>分析备注（可选）</label>
            <textarea v-model="form.notes" rows="2" placeholder="任何补充信息，如：热刺下周有欧冠任务..."></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 分析按钮 -->
    <div v-if="selectedRecord" class="section-card ai-card">
      <h2 class="section-title">🚀 AI 分析入口</h2>
      <p class="section-tip">点击按钮自动复制分析提示词并跳转至对应 AI（部分平台需手动粘贴）</p>
      <div class="ai-grid">
        <button class="ai-btn doubao" @click="analyzeWith('doubao')">
          <span class="ai-icon">🌏</span>
          <span class="ai-name">豆包</span>
          <span class="ai-desc">字节跳动 AI</span>
        </button>
        <button class="ai-btn qianwen" @click="analyzeWith('qianwen')">
          <span class="ai-icon">🔍</span>
          <span class="ai-name">通义千问</span>
          <span class="ai-desc">阿里云 AI</span>
        </button>
        <button class="ai-btn yuanbao" @click="analyzeWith('yuanbao')">
          <span class="ai-icon">💬</span>
          <span class="ai-name">腾讯元宝</span>
          <span class="ai-desc">腾讯混元 AI</span>
        </button>
        <button class="ai-btn kimi" @click="analyzeWith('kimi')">
          <span class="ai-icon">🌙</span>
          <span class="ai-name">Kimi</span>
          <span class="ai-desc">月之暗面 AI</span>
        </button>
        <button class="ai-btn deepseek" @click="analyzeWith('deepseek')">
          <span class="ai-icon">🔬</span>
          <span class="ai-name">DeepSeek</span>
          <span class="ai-desc">深度求索 AI</span>
        </button>
      </div>
      <div v-if="copiedText" class="copy-toast">✅ 提示词已复制，请在 AI 页面 <strong>Ctrl+V 粘贴</strong></div>
    </div>

    <!-- 预览分析提示词 -->
    <div v-if="selectedRecord" class="section-card preview-card">
      <div class="preview-header">
        <h2 class="section-title">📄 生成的提示词（预览）</h2>
        <button class="btn btn-ghost btn-sm" @click="copyPrompt">📋 复制全文</button>
      </div>
      <pre class="prompt-preview">{{ generatedPrompt }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '@/stores/auth'

const filterDate = ref('')
const filterText = ref('')
const loadingRecords = ref(false)
const records = ref([])
const selectedRecord = ref(null)
const copiedText = ref(false)
const fetchingStats = ref(false)
const statsError = ref('')
const statsLoaded = ref(false)

// 补充表单数据
const form = ref({
  home_form: '',
  away_form: '',
  home_goals_per_game: '',
  home_concede_per_game: '',
  away_goals_per_game: '',
  away_concede_per_game: '',
  home_points: '',
  away_points: '',
  home_home_record: '',
  away_away_record: '',
  home_injuries: '',
  away_injuries: '',
  h2h: '',
  notes: '',
})

const availableDates = computed(() => {
  const dates = [...new Set(records.value.map(r => {
    const d = new Date(r.match_time)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }))]
  return dates.sort().reverse()
})

const filteredRecords = computed(() => {
  let list = records.value
  if (filterDate.value) list = list.filter(r => r.match_time.startsWith(filterDate.value))
  if (filterText.value.trim()) {
    const q = filterText.value.trim().toLowerCase()
    list = list.filter(r =>
      r.home_team.toLowerCase().includes(q) ||
      r.away_team.toLowerCase().includes(q) ||
      r.league.toLowerCase().includes(q)
    )
  }
  return list.slice(0, 50)
})

async function loadSweepRecords() {
  loadingRecords.value = true
  try {
    const { data } = await api.get('/admin/sweep', { params: { limit: 500 } })
    records.value = data.records || []
  } catch (e) { console.error(e) }
  loadingRecords.value = false
}

function selectRecord(r) {
  if (selectedRecord.value && selectedRecord.value.id === r.id) {
    selectedRecord.value = null
    statsLoaded.value = false
    return
  }
  selectedRecord.value = r
  statsLoaded.value = false
  statsError.value = ''
  // 重置补充表单
  form.value = { home_form: '', away_form: '', home_goals_per_game: '', home_concede_per_game: '', away_goals_per_game: '', away_concede_per_game: '', home_points: '', away_points: '', home_home_record: '', away_away_record: '', home_injuries: '', away_injuries: '', h2h: '', notes: '' }
  // 联网自动获取基本面
  fetchMatchStats(r.home_team, r.away_team)
}

async function fetchMatchStats(home, away) {
  fetchingStats.value = true
  statsError.value = ''
  try {
    const { data } = await api.get('/football/match-context', { params: { home_team: home, away_team: away } })
    if (data.success && data.context) {
      const ctx = data.context
      // 填充表单
      if (ctx.home) {
        const h = ctx.home
        if (h.form?.length) {
          const win = h.stats?.wins || 0, draw = h.stats?.draws || 0, loss = h.stats?.losses || 0
          form.value.home_form = `胜${win} 平${draw} 负${loss}`
        }
        if (h.stats) {
          form.value.home_goals_per_game = h.stats.goalsPerGame !== '?' ? h.stats.goalsPerGame : ''
          form.value.home_concede_per_game = h.stats.concededPerGame !== '?' ? h.stats.concededPerGame : ''
        }
        if (h.standings) {
          form.value.home_points = h.standings.points || ''
          form.value.home_home_record = h.stats ? `主场${h.stats.wins}胜${h.stats.draws}平${h.stats.losses}负` : ''
        }
      }
      if (ctx.away) {
        const a = ctx.away
        if (a.form?.length) {
          const win = a.stats?.wins || 0, draw = a.stats?.draws || 0, loss = a.stats?.losses || 0
          form.value.away_form = `胜${win} 平${draw} 负${loss}`
        }
        if (a.stats) {
          form.value.away_goals_per_game = a.stats.goalsPerGame !== '?' ? a.stats.goalsPerGame : ''
          form.value.away_concede_per_game = a.stats.concededPerGame !== '?' ? a.stats.concededPerGame : ''
        }
        if (a.standings) {
          form.value.away_points = a.standings.points || ''
          form.value.away_away_record = a.stats ? `客场${a.stats.wins}胜${a.stats.draws}平${a.stats.losses}负` : ''
        }
      }
      if (ctx.h2h && ctx.h2h.length > 0) {
        const hw = ctx.h2h.filter(m => m.winner === 'home').length
        const aw = ctx.h2h.filter(m => m.winner === 'away').length
        const dr = ctx.h2h.length - hw - aw
        form.value.h2h = `近${ctx.h2h.length}场：主队${hw}胜 客队${aw}胜 平${dr}`
      }
      statsLoaded.value = true
    }
  } catch (e) {
    if (e.response?.data?.error) {
      statsError.value = '⚠️ ' + e.response.data.error + '（可手动填写下方字段）'
    } else {
      statsError.value = '⚠️ 获取数据失败，请手动填写下方字段'
    }
  }
  fetchingStats.value = false
}

const RESULT_LABELS = { win: '✅ 红', loss: '❌ 黑', push: '🔄 走', pending: '⏳ 待定' }
function resultLabel(r) { return RESULT_LABELS[r] || r || '-' }
function weekdayShort(w) { return {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'}[w]||'' }
function formatDate(t) { if (!t) return '-'; const d = new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}` }

// 生成分析提示词
const generatedPrompt = computed(() => {
  if (!selectedRecord.value) return ''
  const r = selectedRecord.value
  const f = form.value
  const home = r.home_team
  const away = r.away_team
  const league = r.league
  const matchDate = (() => {
    const d = new Date(r.match_time)
    const wd = ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()]
    return `${d.getMonth()+1}月${d.getDate()}日 ${wd} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  })()

  const homeGoals = f.home_goals_per_game ? `场均进球：${f.home_goals_per_game}球` : ''
  const homeConcede = f.home_concede_per_game ? `场均失球：${f.home_concede_per_game}球` : ''
  const awayGoals = f.away_goals_per_game ? `场均进球：${f.away_goals_per_game}球` : ''
  const awayConcede = f.away_concede_per_game ? `场均失球：${f.away_concede_per_game}球` : ''
  const homePoints = f.home_points ? `第${f.home_points}名` : ''
  const awayPoints = f.away_points ? `第${f.away_points}名` : ''
  const homeRec = f.home_home_record || ''
  const awayRec = f.away_away_record || ''

  const extraInfo = [
    (homePoints || awayPoints) ? `积分榜：${home} ${homePoints ? '第' + homePoints + '名' : '?'}，${away} ${awayPoints ? '第' + awayPoints + '名' : '?'}` : '',
    f.home_form ? `${home}近期战绩：${f.home_form}` : '',
    f.away_form ? `${away}近期战绩：${f.away_form}` : '',
    (homeGoals || homeConcede) ? `${home}：${[homeGoals, homeConcede].filter(Boolean).join('，')}` : '',
    (awayGoals || awayConcede) ? `${away}：${[awayGoals, awayConcede].filter(Boolean).join('，')}` : '',
    homeRec ? `${home}主场：${homeRec}` : '',
    awayRec ? `${away}客场：${awayRec}` : '',
    f.h2h ? `历史交锋：${f.h2h}` : '',
  ].filter(Boolean).join('\n')

  return `你现在是一名拥有10年经验的资深足球数据分析师，请根据我提供的基本面数据，对本场比赛进行客观、多维度的专业前瞻分析。

【输入数据】
赛事：${league}；对阵：${home} (主) VS ${away} (客)
${extraInfo}

${f.home_injuries || f.away_injuries ? `【伤停信息】
主队伤停：${f.home_injuries || '未获取'}
客队伤停：${f.away_injuries || '未获取'}` : ''}

${f.notes ? `【补充信息】
${f.notes}` : ''}

【分析要求】
第一部分：核心结论与推荐
比赛定调（双方状态对比总结）
预测置信度（星级评分 + 简要说明）
胜平负倾向 （获取实时盘指数，给出具体概率）
亚盘倾向（获取实时盘指数）（给出具体概率）
大小球倾向（获取实时盘指数）（给出具体概率）
比分预测（列出3个可能比分）（给出具体概率）

第二部分：多维专业前瞻分析
1. 【实力定位】：对比双方目前的联赛地位与整体实力差距。
2. 【状态对比】：结合近6场战绩，剖析双方近期的攻防起伏。
3. 【交锋心理】：根据历史交战记录，分析是否存在球风克制。
4. 【主客场因素】：结合主队主场表现与客队客场表现，分析场地环境对比赛走势的影响，判断哪一方更容易掌控比赛节奏。
5. 【走势关键点】从控球节奏、攻防转换效率、后场抗压能力、定位球处理、禁区终结质量等角度，判断本场最可能影响比赛走向的核心因素。
6. 【走势场景与终局形态】
结合双方近期状态、攻防数据、人员情况与技战术匹配度，分析本场较可能出现的比赛走势场景，并给出审慎的终局形态判断。
请明确输出：
- 走势形态：控场型 / 反击型 / 胶着型 / 开放型 / 消耗型；
- 方向落点：A 方更占主动 / 双方难以拉开差距 / B 方更占主动；
- 信心等级：高 / 中 / 低；
- 参考比分样例：给出 1-2 个合理比分；
- 形成逻辑：说明支撑该判断的核心原因；
- 偏离因素：说明可能改变判断的关键变量。
注意：
A 方代表主场一方（${home}），B 方代表客场一方（${away}）。即使双方实力接近，也需要给出一个相对明确的方向落点；若判断难度较高，请标注为"低信心"。
注：以上数据分析仅供体育爱好者参考及自媒体内容创作使用，不构成任何投注及购彩建议，请遵守国家法律，理性看球。`
})

function encodePrompt(text) {
  return encodeURIComponent(text)
}

async function analyzeWith(platform) {
  const prompt = generatedPrompt.value
  if (!prompt) return
  // 复制到剪贴板
  try {
    await navigator.clipboard.writeText(prompt)
    copiedText.value = true
    setTimeout(() => { copiedText.value = false }, 5000)
  } catch (e) {
    copiedText.value = false
  }
  // 跳转
  const urls = {
    doubao: 'https://www.doubao.com/chat/',
    qianwen: 'https://qianwen.aliyun.com/',
    yuanbao: 'https://yuanbao.tencent.com/chat/',
    kimi: 'https://kimi.moonshot.cn/',
    deepseek: 'https://chat.deepseek.com/',
  }
  const url = urls[platform]
  if (url) window.open(url, '_blank')
}

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(generatedPrompt.value)
    copiedText.value = true
    setTimeout(() => { copiedText.value = false }, 3000)
  } catch (e) {}
}

onMounted(() => {
  loadSweepRecords()
})
</script>

<style scoped>
.page { max-width: 960px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }

.section-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
.section-title { font-size: 15px; font-weight: 700; color: #E6EDF3; margin-bottom: 6px; }
.section-tip { color: #8B949E; font-size: 13px; margin-bottom: 16px; }

.filter-row { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.filter-select { padding: 8px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 13px; }
.filter-input { flex: 1; min-width: 160px; padding: 8px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 13px; }

.loading { color: #8B949E; font-size: 13px; padding: 20px; text-align: center; }
.empty { color: #8B949E; font-size: 13px; padding: 20px; text-align: center; }

.records-list { max-height: 320px; overflow-y: auto; border: 1px solid #21262D; border-radius: 8px; }
.record-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #21262D; transition: background 0.12s; }
.record-row:last-child { border-bottom: none; }
.record-row:hover { background: #1C2128; }
.record-row.selected { background: rgba(88,166,255,0.1); border-left: 3px solid #58A6FF; }
.record-main { display: flex; gap: 12px; align-items: center; flex: 1; flex-wrap: wrap; }
.r-date { font-size: 12px; color: #8B949E; min-width: 70px; }
.r-teams { font-size: 13px; color: #E6EDF3; font-weight: 600; }
.vs { color: #58A6FF; margin: 0 4px; }
.r-league { font-size: 11px; color: #8B949E; background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 4px; }
.r-matchno { font-size: 11px; color: #8B949E; }
.record-meta { display: flex; gap: 6px; align-items: center; }
.r-result { font-size: 11px; padding: 2px 8px; border-radius: 4px; }
.r-result.win { color: #3FB950; background: rgba(63,185,80,0.1); }
.r-result.loss { color: #F85149; background: rgba(248,81,73,0.1); }
.r-cat { font-size: 10px; color: #8B949E; }
.record-select-icon { font-size: 16px; }

.form-section { }
.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 12px; color: #8B949E; }
.form-group input, .form-group textarea, .form-group select { padding: 8px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 13px; outline: none; font-family: inherit; resize: vertical; }
.form-group textarea { resize: vertical; }

/* AI 入口 */
.ai-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-top: 16px; }
.ai-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px 12px; border-radius: 12px; border: 1px solid #21262D; background: #0D1117; cursor: pointer; transition: all 0.15s; font-family: inherit; color: #C9D1D9; }
.ai-btn:hover { border-color: #58A6FF; background: #161B22; transform: translateY(-1px); }
.ai-icon { font-size: 28px; }
.ai-name { font-size: 14px; font-weight: 700; color: #E6EDF3; }
.ai-desc { font-size: 11px; color: #8B949E; }

.loading-tag { font-size: 12px; margin-left: 8px; font-weight: 400; }
.loading-tag.ok { color: #3FB950; }
.loading-tag.warn { color: #D29922; }

.copy-toast { margin-top: 10px; padding: 10px 14px; background: rgba(63,185,80,0.1); border: 1px solid rgba(63,185,80,0.3); border-radius: 8px; color: #3FB950; font-size: 13px; }
.preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.preview-card pre { background: #0D1117; border: 1px solid #21262D; border-radius: 8px; padding: 16px; font-size: 12px; color: #C9D1D9; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow-y: auto; line-height: 1.6; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: 1px solid #30363D; background: #21262D; color: #C9D1D9; cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.15s; }
.btn:hover { background: #30363D; }
.btn-ghost { background: transparent; border-color: #30363D; }
.btn-ghost:hover { background: #21262D; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.doubao:hover { border-color: #00C7BE; }
.qianwen:hover { border-color: #00C7BE; }
.yuanbao:hover { border-color: #00C7BE; }
.kimi:hover { border-color: #00C7BE; }
.deepseek:hover { border-color: #00C7BE; }

.copy-toast { margin-top: 12px; padding: 10px 16px; background: rgba(63,185,80,0.1); border: 1px solid #3FB950; border-radius: 8px; color: #3FB950; font-size: 13px; }

/* 预览 */
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.prompt-preview { background: #0D1117; border: 1px solid #21262D; border-radius: 8px; padding: 16px; font-size: 12px; color: #C9D1D9; line-height: 1.7; white-space: pre-wrap; word-break: break-all; max-height: 500px; overflow-y: auto; font-family: 'JetBrains Mono', 'Courier New', monospace; }

.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.15s; font-family: inherit; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { border-color: #58A6FF; color: #58A6FF; }
.mono { font-family: 'JetBrains Mono', monospace; }

@media (max-width: 600px) {
  .ai-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
