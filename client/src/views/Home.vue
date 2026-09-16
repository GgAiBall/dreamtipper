<template>
  <div class="home">
    <!-- 顶部导航 -->
    <header class="header">
      <div class="header-inner">
        <div class="logo">
          <span class="logo-icon">📊</span>
          <span class="logo-text">梦幻竞彩家</span>
        </div>
        <nav class="nav">
          <router-link to="/">首页</router-link>
          <router-link to="/data">扫盘数据</router-link>
          <router-link to="/plans">方案市场</router-link>
          <router-link to="/stats">战绩统计</router-link>
          <router-link to="/analysis">实时分析</router-link>
          <router-link to="/dashboard" v-if="auth.isLoggedIn">会员中心</router-link>
          <router-link to="/admin" v-if="auth.isAdmin" class="admin-link">管理后台</router-link>
        </nav>
        <div class="header-actions">
          <router-link to="/login" v-if="!auth.isLoggedIn" class="btn btn-ghost">登录</router-link>
          <router-link to="/register" v-if="!auth.isLoggedIn" class="btn btn-primary">注册</router-link>
          <span v-if="auth.isLoggedIn" class="user-info">
            <span class="tier-badge" :class="auth.tier">{{ tierLabel }}</span>
            <router-link to="/dashboard">{{ auth.user?.nickname || '用户' }}</router-link>
            <button @click="handleLogout" class="btn btn-ghost btn-sm">退出</button>
          </span>
        </div>
      </div>
    </header>

    <!-- 英雄区 -->
    <section class="hero">
      <div class="hero-inner">
        <h1 class="hero-title">专业体育数据 · 透明战绩 · 理性决策</h1>
        <p class="hero-sub">20年赛事分析经验，每日扫盘数据实时更新，付费方案战绩全程可追溯</p>
        <div class="hero-actions">
          <router-link to="/data" class="btn btn-primary btn-lg">查看今日扫盘</router-link>
          <router-link to="/analysis" class="btn btn-ghost btn-lg">实时分析</router-link>
          <router-link to="/stats" class="btn btn-ghost btn-lg">战绩统计</router-link>
        </div>
      </div>
    </section>

    <!-- 核心数据 -->
    <section class="stats-bar">
      <div class="stats-bar-inner">
        <div class="stat-item" v-for="s in overviewStats" :key="s.label">
          <div class="stat-value mono">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <!-- 今日扫盘预览 -->
    <section class="section">
      <div class="section-inner">
        <div class="section-header">
          <h2>📅 今日扫盘</h2>
          <router-link to="/data" class="btn btn-ghost btn-sm">查看全部 →</router-link>
        </div>
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else class="records-grid">
          <div class="record-card" v-for="r in todayRecords" :key="r.id">
            <div class="rc-header">
              <span class="rc-league">{{ r.league }}</span>
              <span class="rc-time mono">{{ formatTime(r.match_time) }}</span>
              <span class="rc-match-no">{{ weekdayShort(r.weekday) }}{{ r.match_no }}</span>
            </div>
            <div class="rc-match">
              <div class="rc-team">{{ r.home_team }}</div>
              <div class="rc-vs">VS</div>
              <div class="rc-team">{{ r.away_team }}</div>
            </div>
            <div class="rc-info">
              <span class="rc-handicap" v-if="r.handicap && r.handicap !== '[]'">{{ formatHandicap(r.handicap) }}</span>
              <span class="rc-odds mono" v-if="r.odds != null && r.odds !== ''">@ {{ r.odds }}</span>
              <span class="rc-stars">
                <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= (r.confidence_stars || 0) }">★</span>
              </span>
              <span class="rc-tier" :class="r.tier_required">{{ tierTag(r.tier_required) }}</span>
            </div>
            <div class="rc-result" v-if="r.result && r.result !== 'pending'" :class="r.result">
              {{ resultLabel(r.result) }}
            </div>
          </div>
          <div v-if="todayRecords.length === 0" class="empty-state">
            <p>暂无今日扫盘数据</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 战绩公示 -->
    <section class="section section-dark">
      <div class="section-inner">
        <div class="section-header">
          <h2>🏆 战绩统计</h2>
          <router-link to="/stats" class="btn btn-ghost btn-sm">详细统计 →</router-link>
        </div>
        <div class="overview-cards" v-if="overview">
          <div class="overview-card">
            <div class="oc-label">近7天胜率</div>
            <div class="oc-value mono" :class="winRateClass(overview.comparison.recent7.win_rate)">
              {{ overview.comparison.recent7.win_rate }}%
            </div>
            <div class="oc-sub">{{ overview.comparison.recent7.wins }}胜 {{ overview.comparison.recent7.losses }}负</div>
          </div>
          <div class="overview-card">
            <div class="oc-label">近30天胜率</div>
            <div class="oc-value mono" :class="winRateClass(overview.comparison.recent30.win_rate)">
              {{ overview.comparison.recent30.win_rate }}%
            </div>
            <div class="oc-sub">{{ overview.comparison.recent30.wins }}胜 {{ overview.comparison.recent30.losses }}负</div>
          </div>
          <div class="overview-card highlight">
            <div class="oc-label">总战绩</div>
            <div class="oc-value mono" :class="winRateClass(overview.totals.win_rate)">
              {{ overview.totals.win_rate }}%
            </div>
            <div class="oc-sub">{{ overview.totals.wins }}胜 {{ overview.totals.losses }}负 {{ overview.totals.pushes }}走</div>
          </div>
          <div class="overview-card">
            <div class="oc-label">当前连红</div>
            <div class="oc-value mono" :class="overview.streak.win > 0 ? 'win' : 'loss'">
              {{ overview.streak.win > 0 ? overview.streak.win + '连红' : overview.streak.loss + '连黑' }}
            </div>
            <div class="oc-sub">最长连红 / 连黑</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 方案推荐 -->
    <section class="section">
      <div class="section-inner">
        <div class="section-header">
          <h2>📋 订阅方案</h2>
          <router-link to="/plans" class="btn btn-ghost btn-sm">查看全部 →</router-link>
        </div>
        <div class="plans-preview" v-if="plans.length">
          <div class="plan-card" v-for="p in plans.slice(0,3)" :key="p.id">
            <div class="pc-name">{{ p.name }}</div>
            <div class="pc-desc">{{ p.description }}</div>
            <div class="pc-stats" v-if="p.stats">
              <span>胜率 {{ p.stats.win_rate || 0 }}%</span>
              <span>订阅 {{ p.subscriber_count }}</span>
            </div>
            <div class="pc-price mono">
              {{ p.price === 0 ? '免费' : '¥' + (p.price / 100).toFixed(0) }}
            </div>
            <router-link :to="`/plans/${p.id}`" class="btn btn-ghost btn-sm">查看详情</router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="footer">
      <p>© 2024 梦幻竞彩家 · 专业体育数据分析平台 · 数据仅供参考，理性投注</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const todayRecords = ref([])
const overview = ref(null)
const plans = ref([])
const loading = ref(true)

const tierLabel = computed(() => ({ free: '免费', monthly: '月度', yearly: '年度' }[auth.tier] || '免费'))
const overviewStats = computed(() => {
  if (!overview.value) return []
  const o = overview.value.totals
  return [
    { label: '总推荐', value: o.total || 0 },
    { label: '胜率', value: (o.win_rate || 0) + '%' },
    { label: '胜/走/负', value: `${o.wins || 0}/${o.pushes || 0}/${o.losses || 0}` },
    { label: '净盈亏', value: (o.net || 0) > 0 ? '+' + o.net : o.net },
    { label: '订阅会员', value: '1,280+' },
  ]
})

function tierTag(t) {
  return { free: '🆓 免费', monthly: '💎 月度', yearly: '👑 年度' }[t] || t
}
function weekdayShort(w) { return {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'}[w]||'' }
function resultLabel(r) {
  return { win: '✅ 红', loss: '❌ 黑', push: '🔄 走' }[r] || r
}
function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
}
function formatHandicap(h) {
  if (!h) return ''
  try {
    const v = JSON.parse(h)
    if (Array.isArray(v)) return v.map(p => p.pick).join(' / ')
    if (v && typeof v === 'object') return Object.values(v).map(p => p.pick || p).join(' / ')
    return String(h)
  } catch { return String(h) }
}
function winRateClass(w) {
  if (w >= 60) return 'win'
  if (w >= 50) return 'neutral'
  return 'loss'
}
function handleLogout() {
  auth.logout()
  router.push('/')
}

onMounted(async () => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const [sweepRes, statsRes, plansRes] = await Promise.all([
      api.get('/sweep', { params: { date: today } }),
      api.get('/stats/overview'),
      api.get('/plans'),
    ])
    todayRecords.value = sweepRes.data.records.slice(0, 6)
    overview.value = statsRes.data
    plans.value = plansRes.data.plans
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.home { min-height: 100vh; background: #0D1117; }

/* Header */
.header { position: sticky; top: 0; z-index: 100; background: rgba(13,17,23,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid #21262D; }
.header-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; gap: 32px; }
.logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 18px; color: #E6EDF3; }
.logo-icon { font-size: 24px; }
.nav { display: flex; gap: 4px; flex: 1; }
.nav a { padding: 6px 12px; border-radius: 6px; color: #8B949E; font-size: 14px; transition: all 0.2s; }
.nav a:hover, .nav a.router-link-active { color: #E6EDF3; background: #21262D; }
.admin-link { color: #F0883E !important; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.user-info { display: flex; align-items: center; gap: 8px; font-size: 14px; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; text-decoration: none; }
.btn-sm { padding: 5px 10px; font-size: 13px; }
.btn-lg { padding: 12px 28px; font-size: 16px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-primary:hover { background: #79B8FF; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { background: #21262D; color: #E6EDF3; }

/* Hero */
.hero { padding: 80px 24px; text-align: center; background: linear-gradient(180deg, #161B22 0%, #0D1117 100%); }
.hero-inner { max-width: 700px; margin: 0 auto; }
.hero-title { font-size: 42px; font-weight: 700; line-height: 1.2; margin-bottom: 16px; background: linear-gradient(135deg, #E6EDF3 0%, #58A6FF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 18px; color: #8B949E; margin-bottom: 32px; }
.hero-actions { display: flex; gap: 12px; justify-content: center; }

/* Stats Bar */
.stats-bar { background: #161B22; border-top: 1px solid #21262D; border-bottom: 1px solid #21262D; padding: 20px 24px; }
.stats-bar-inner { max-width: 1200px; margin: 0 auto; display: flex; gap: 40px; justify-content: center; }
.stat-item { text-align: center; }
.stat-value { font-size: 24px; font-weight: 700; color: #58A6FF; }
.stat-label { font-size: 12px; color: #8B949E; margin-top: 2px; }

/* Sections */
.section { padding: 60px 24px; }
.section-dark { background: #161B22; }
.section-inner { max-width: 1200px; margin: 0 auto; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.section-header h2 { font-size: 22px; font-weight: 700; }

/* Records */
.records-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.record-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 16px; transition: border-color 0.2s; }
.record-card:hover { border-color: #30363D; }
.rc-header { display: flex; justify-content: space-between; font-size: 12px; color: #8B949E; margin-bottom: 8px; }
.rc-match { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.rc-team { font-size: 15px; font-weight: 600; flex: 1; text-align: center; }
.rc-vs { font-size: 11px; color: #8B949E; }
.rc-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #8B949E; flex-wrap: wrap; }
.rc-odds { color: #58A6FF; font-size: 14px; font-weight: 600; }
.rc-stars .star { color: #30363D; font-size: 12px; }
.rc-stars .star.active { color: #F0883E; }
.rc-tier { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #21262D; }
.rc-tier.monthly { background: rgba(88,166,255,0.15); color: #58A6FF; }
.rc-tier.yearly { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.rc-result { margin-top: 8px; text-align: center; font-weight: 600; font-size: 14px; padding: 4px; border-radius: 6px; }
.rc-result.win { background: rgba(63,185,80,0.15); color: #3FB950; }
.rc-result.loss { background: rgba(248,81,73,0.15); color: #F85149; }
.rc-result.push { background: rgba(139,148,158,0.15); color: #8B949E; }

/* Overview Cards */
.overview-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.overview-card { background: #21262D; border-radius: 12px; padding: 20px; text-align: center; }
.overview-card.highlight { border: 1px solid #58A6FF; background: rgba(88,166,255,0.08); }
.oc-label { font-size: 13px; color: #8B949E; margin-bottom: 8px; }
.oc-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
.oc-value.win { color: #3FB950; }
.oc-value.neutral { color: #F0883E; }
.oc-value.loss { color: #F85149; }
.oc-sub { font-size: 12px; color: #8B949E; }

/* Plans Preview */
.plans-preview { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.plan-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.pc-name { font-size: 16px; font-weight: 700; color: #E6EDF3; }
.pc-desc { font-size: 13px; color: #8B949E; flex: 1; }
.pc-stats { display: flex; gap: 12px; font-size: 12px; color: #58A6FF; }
.pc-price { font-size: 20px; font-weight: 700; color: #3FB950; }

/* Tier Badge */
.tier-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.tier-badge.free { background: #21262D; color: #8B949E; }
.tier-badge.monthly { background: rgba(88,166,255,0.2); color: #58A6FF; }
.tier-badge.yearly { background: rgba(255,191,46,0.2); color: #FFBF2E; }

/* Loading */
.loading { color: #8B949E; padding: 40px; text-align: center; }
.empty-state { grid-column: 1/-1; text-align: center; color: #8B949E; padding: 40px; }

/* Footer */
.footer { text-align: center; padding: 24px; border-top: 1px solid #21262D; color: #8B949E; font-size: 13px; }
</style>
