<template>
  <div class="page">
    <div class="page-header">
      <h1>📈 战绩统计</h1>
      <p>全程透明可追溯，数据真实可查</p>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <template v-else-if="data">
      <!-- 核心指标 -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">总推荐</div>
          <div class="kpi-value mono">{{ data.totals.total }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">胜率</div>
          <div class="kpi-value mono" :class="winClass(data.totals.win_rate)">{{ data.totals.win_rate }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">胜 / 走 / 负</div>
          <div class="kpi-value mono">{{ data.totals.wins }} / {{ data.totals.pushes }} / {{ data.totals.losses }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">净盈亏</div>
          <div class="kpi-value mono" :class="data.totals.net >= 0 ? 'win' : 'loss'">{{ data.totals.net > 0 ? '+' : '' }}{{ data.totals.net }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">近7天胜率</div>
          <div class="kpi-value mono" :class="winClass(data.comparison.recent7.win_rate)">{{ data.comparison.recent7.win_rate }}%</div>
        </div>
        <div class="kpi-card highlight">
          <div class="kpi-label">近30天胜率</div>
          <div class="kpi-value mono" :class="winClass(data.comparison.recent30.win_rate)">{{ data.comparison.recent30.win_rate }}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">当前连红</div>
          <div class="kpi-value mono" :class="data.streak.win > 0 ? 'win' : 'loss'">
            {{ data.streak.win > 0 ? '🔥 ' + data.streak.win + '连红' : data.streak.loss + '连黑' }}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">订阅人数</div>
          <div class="kpi-value mono">1,280+</div>
        </div>
      </div>

      <!-- 胜率走势图 -->
      <div class="chart-section">
        <h3>近{{ data.dailyStats.length }}天胜率走势</h3>
        <div ref="chartRef" class="chart"></div>
      </div>

      <!-- 信心星级分布 -->
      <div class="section">
        <h3>信心星级 vs 胜率</h3>
        <div class="star-table">
          <div class="st-row header">
            <span>信心星级</span><span>总场次</span><span>胜</span><span>负</span><span>胜率</span>
          </div>
          <div class="st-row" v-for="s in data.starStats" :key="s.confidence_stars">
            <span>
              <span v-for="n in 5" :key="n" class="star" :class="{ active: n <= s.confidence_stars }">★</span>
            </span>
            <span class="mono">{{ s.total }}</span>
            <span class="mono win">{{ s.wins }}</span>
            <span class="mono loss">{{ s.losses }}</span>
            <span class="mono" :class="winClass(s.win_rate)">{{ s.win_rate }}%</span>
          </div>
        </div>
      </div>

      <!-- 联赛分布 -->
      <div class="section">
        <h3>各联赛战绩</h3>
        <div class="league-grid">
          <div class="lg-card" v-for="l in data.leagueStats" :key="l.league">
            <div class="lg-name">{{ l.league }}</div>
            <div class="lg-rate mono" :class="winClass(l.win_rate)">{{ l.win_rate }}%</div>
            <div class="lg-detail mono">{{ l.wins }}胜 {{ l.losses }}负</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { api } from '@/stores/auth'

const data = ref(null)
const loading = ref(true)
const chartRef = ref(null)

function winClass(w) {
  if (w >= 55) return 'win'
  if (w >= 48) return 'neutral'
  return 'loss'
}

function renderChart() {
  if (!chartRef.value || !data.value) return
  const stats = data.value.dailyStats.slice(-30)
  const chart = echarts.init(chartRef.value)
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#21262D', borderColor: '#30363D', textStyle: { color: '#E6EDF3' } },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: stats.map(s => s.date?.slice(5)), axisLine: { lineStyle: { color: '#30363D' } }, axisLabel: { color: '#8B949E', fontSize: 10 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLine: { lineStyle: { color: '#30363D' } }, splitLine: { lineStyle: { color: '#21262D' } }, axisLabel: { color: '#8B949E', formatter: '{value}%' } },
    series: [
      { data: stats.map(s => s.win_rate), type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: '#58A6FF', width: 2 }, itemStyle: { color: '#58A6FF' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(88,166,255,0.3)' }, { offset: 1, color: 'rgba(88,166,255,0)' }] } } },
      { data: stats.map(s => s.profit_rate), type: 'bar', yAxisIndex: 0, barWidth: '50%', itemStyle: { color: (p) => p.data >= 0 ? '#3FB950' : '#F85149', opacity: 0.6 } }
    ]
  })
}

onMounted(async () => {
  try {
    const { data: res } = await api.get('/stats/overview', { params: { days: 30 } })
    data.value = res
    await nextTick()
    renderChart()
  } catch (e) { console.error(e) }
  finally { loading.value = false }
})
</script>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.loading { text-align: center; color: #8B949E; padding: 60px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 32px; }
.kpi-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 20px; }
.kpi-card.highlight { border-color: #58A6FF; background: rgba(88,166,255,0.06); }
.kpi-label { font-size: 12px; color: #8B949E; margin-bottom: 6px; }
.kpi-value { font-size: 22px; font-weight: 700; }
.kpi-value.win { color: #3FB950; }
.kpi-value.neutral { color: #F0883E; }
.kpi-value.loss { color: #F85149; }
.chart-section { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.chart-section h3, .section h3 { font-size: 16px; margin-bottom: 16px; color: #E6EDF3; }
.chart { width: 100%; height: 280px; }
.section { margin-bottom: 24px; }
.star-table { background: #161B22; border: 1px solid #21262D; border-radius: 12px; overflow: hidden; }
.st-row { display: grid; grid-template-columns: 120px 80px 60px 60px 80px; gap: 8px; padding: 12px 16px; font-size: 13px; align-items: center; border-bottom: 1px solid #21262D; }
.st-row:last-child { border-bottom: none; }
.st-row.header { background: #21262D; color: #8B949E; font-size: 12px; font-weight: 600; }
.star { color: #30363D; font-size: 12px; }
.star.active { color: #F0883E; }
.win { color: #3FB950; }
.loss { color: #F85149; }
.league-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.lg-card { background: #161B22; border: 1px solid #21262D; border-radius: 10px; padding: 16px; text-align: center; }
.lg-name { font-size: 13px; color: #8B949E; margin-bottom: 6px; }
.lg-rate { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.lg-detail { font-size: 11px; color: #8B949E; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
