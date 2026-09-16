<template>
  <div class="page">
    <div class="page-header">
      <h1>📡 实时分析</h1>
      <p>赛事实时分析、赛前观点与深度拆解，由分析师持续更新。</p>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="posts.length === 0" class="empty">暂无分析内容，敬请期待。</div>

    <div class="analysis-grid" v-else>
      <router-link v-for="p in posts" :key="p.id" :to="`/analysis/${p.id}`" class="analysis-card">
        <div v-if="p.image_url" class="card-img" :style="{ backgroundImage: `url(${p.image_url})` }"></div>
        <div class="card-body">
          <span class="cat-tag" :class="catClass(p.category)">{{ p.category || '实时分析' }}</span>
          <h3 class="card-title">{{ p.title }}</h3>
          <p class="card-excerpt">{{ excerpt(p.content) }}</p>
          <div class="card-foot">
            <span class="mono time">{{ formatDate(p.created_at) }}</span>
            <span class="read-more">阅读 →</span>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'

const posts = ref([])
const loading = ref(true)

function catClass(c) {
  return { '实时分析': 'cat-manual', '赛前分析': 'cat-ai', '深度拆解': 'cat-god' }[c] || 'cat-other'
}
function excerpt(text) {
  if (!text) return ''
  const t = String(text).replace(/[#>*`]/g, '').replace(/\n+/g, ' ').trim()
  return t.length > 80 ? t.slice(0, 80) + '…' : t
}
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d.replace(' ', 'T'))
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  try {
    const { data } = await api.get('/analysis')
    posts.value = data.posts || []
  } catch (e) { console.error(e) }
  finally { loading.value = false }
})
</script>

<style scoped>
.page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 28px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.loading, .empty { text-align: center; color: #8B949E; padding: 60px; }
.analysis-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
.analysis-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; transition: all 0.2s; display: flex; flex-direction: column; }
.analysis-card:hover { border-color: #58A6FF; transform: translateY(-2px); }
.card-img { height: 140px; background-size: cover; background-position: center; background-color: #0D1117; }
.card-body { padding: 18px; flex: 1; display: flex; flex-direction: column; }
.cat-tag { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 600; align-self: flex-start; margin-bottom: 10px; }
.cat-manual { background: rgba(88,166,255,0.15); color: #58A6FF; }
.cat-ai { background: rgba(163,113,247,0.15); color: #A371F7; }
.cat-god { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.cat-other { background: rgba(139,148,158,0.15); color: #8B949E; }
.card-title { font-size: 17px; margin-bottom: 8px; line-height: 1.4; }
.card-excerpt { color: #8B949E; font-size: 13px; line-height: 1.6; flex: 1; }
.card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; font-size: 12px; color: #8B949E; }
.read-more { color: #58A6FF; font-weight: 600; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
