<template>
  <div class="page">
    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="plan">
      <div class="page-header">
        <router-link to="/plans" class="back-link">← 返回方案市场</router-link>
        <h1>{{ plan.name }}</h1>
        <p>{{ plan.description }}</p>
      </div>
      <div class="detail-grid">
        <div class="stats-panel">
          <h3>历史战绩</h3>
          <div v-if="stats">
            <div class="sp-item"><span>胜率</span><strong class="mono" :class="winClass(stats.win_rate)">{{ stats.win_rate }}%</strong></div>
            <div class="sp-item"><span>总场次</span><strong class="mono">{{ stats.total }}</strong></div>
            <div class="sp-item"><span>胜/负/走</span><strong class="mono">{{ stats.wins }} / {{ stats.losses }} / {{ stats.pushes }}</strong></div>
            <div class="sp-item"><span>赔率展示</span><strong class="mono" :class="stats.avg_odds > 0 ? 'win' : 'loss'">{{ stats.avg_odds > 0 ? stats.avg_odds.toFixed(2) : '-' }}</strong></div>
            <div class="sp-item"><span>总收益</span><strong class="mono" :class="stats.total_profit >= 0 ? 'win' : 'loss'">{{ stats.total_profit >= 0 ? '+' : '' }}{{ stats.total_profit }}</strong></div>
          </div>
          <div ref="chartRef" class="chart"></div>
        </div>
        <div class="recs-panel">
          <h3>推荐记录</h3>
          <div class="rec-item" v-for="r in recommendations" :key="r.id">
            <div class="rec-header">
              <span>{{ r.home_team }} VS {{ r.away_team }}</span>
              <span class="rec-time mono">{{ formatTime(r.published_at) }}</span>
            </div>
            <div class="rec-body">{{ r.title }}</div>
            <div class="rec-result" :class="r.result">{{ resultLabel(r.result) }}</div>
          </div>
          <div v-if="recommendations.length === 0" class="empty">暂无推荐记录</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import * as echarts from 'echarts'
import { api } from '@/stores/auth'

const route = useRoute()
const plan = ref(null)
const stats = ref(null)
const recommendations = ref([])
const loading = ref(true)
const chartRef = ref(null)

function winClass(w) { if (w >= 55) return 'win'; if (w >= 48) return 'neutral'; return 'loss' }
function resultLabel(r) { return { win: '✅ 红', loss: '❌ 黑', push: '🔄 走', pending: '⏳ 待定' }[r] || r }
function formatTime(t) { if (!t) return '-'; return new Date(t).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit' }) }

function renderChart(daily) {
  if (!chartRef.value || !daily?.length) return
  const c = echarts.init(chartRef.value)
  c.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#21262D', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
    grid: { left: 40, right: 10, top: 10, bottom: 25 },
    xAxis: { type: 'category', data: daily.map(s => s.date?.slice(5)), axisLine: { lineStyle: { color: '#30363D' } }, axisLabel: { color: '#8B949E', fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLine: { lineStyle: { color: '#30363D' } }, splitLine: { lineStyle: { color: '#21262D' } }, axisLabel: { color: '#8B949E', formatter: '{value}%' } },
    series: [{ data: daily.map(s => s.win_rate), type: 'line', smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { color: '#58A6FF', width: 2 }, itemStyle: { color: '#58A6FF' } }]
  })
}

onMounted(async () => {
  try {
    const [planRes, statsRes] = await Promise.all([
      api.get(`/plans/${route.params.id}`),
      api.get(`/stats/plans/${route.params.id}`)
    ])
    plan.value = planRes.data.plan
    recommendations.value = planRes.data.recommendations
    stats.value = statsRes.data.stats
    await nextTick()
    renderChart(statsRes.data.daily)
  } catch (e) { console.error(e) }
  finally { loading.value = false }
})
</script>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.loading, .empty { text-align: center; color: #8B949E; padding: 40px; }
.page-header { margin-bottom: 32px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; }
.detail-grid { display: grid; grid-template-columns: 360px 1fr; gap: 20px; }
@media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } }
.stats-panel, .recs-panel { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.stats-panel h3, .recs-panel h3 { font-size: 15px; margin-bottom: 16px; color: #E6EDF3; }
.sp-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #21262D; font-size: 13px; }
.sp-item strong { font-size: 16px; }
.sp-item .win { color: #3FB950; }
.sp-item .loss { color: #F85149; }
.sp-item .neutral { color: #F0883E; }
.chart { width: 100%; height: 200px; margin-top: 12px; }
.rec-item { padding: 12px 0; border-bottom: 1px solid #21262D; }
.rec-item:last-child { border-bottom: none; }
.rec-header { display: flex; justify-content: space-between; font-size: 13px; color: #8B949E; margin-bottom: 4px; }
.rec-body { font-size: 13px; color: #E6EDF3; margin-bottom: 4px; }
.rec-result { font-size: 12px; font-weight: 600; }
.rec-result.win { color: #3FB950; }
.rec-result.loss { color: #F85149; }
.rec-result.pending { color: #F0883E; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
