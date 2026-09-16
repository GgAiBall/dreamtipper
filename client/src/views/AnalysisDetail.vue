<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/analysis" class="back-link">← 返回实时分析</router-link>
      <div v-if="loading" class="loading">加载中...</div>
      <article v-else-if="post" class="article">
        <span class="cat-tag" :class="catClass(post.category)">{{ post.category || '实时分析' }}</span>
        <h1 class="title">{{ post.title }}</h1>
        <div class="meta mono">🕒 {{ formatDate(post.created_at) }}</div>
        <div v-if="post.image_url" class="cover" :style="{ backgroundImage: `url(${post.image_url})` }"></div>
        <div class="content">{{ post.content }}</div>
      </article>
      <div v-else class="empty">未找到该文章。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/stores/auth'

const route = useRoute()
const post = ref(null)
const loading = ref(true)

function catClass(c) {
  return { '实时分析': 'cat-manual', '赛前分析': 'cat-ai', '深度拆解': 'cat-god' }[c] || 'cat-other'
}
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d.replace(' ', 'T'))
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/analysis/${route.params.id}`)
    post.value = data.post
  } catch (e) { console.error(e) }
  finally { loading.value = false }
})
</script>

<style scoped>
.page { max-width: 820px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 16px; }
.loading, .empty { text-align: center; color: #8B949E; padding: 60px; }
.cat-tag { font-size: 11px; padding: 3px 10px; border-radius: 4px; font-weight: 600; }
.cat-manual { background: rgba(88,166,255,0.15); color: #58A6FF; }
.cat-ai { background: rgba(163,113,247,0.15); color: #A371F7; }
.cat-god { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.cat-other { background: rgba(139,148,158,0.15); color: #8B949E; }
.title { font-size: 28px; margin: 14px 0 10px; line-height: 1.35; }
.meta { color: #8B949E; font-size: 13px; margin-bottom: 18px; }
.cover { height: 220px; background-size: cover; background-position: center; background-color: #0D1117; border-radius: 12px; margin-bottom: 22px; }
.content { font-size: 15px; line-height: 1.9; color: #C9D1D9; white-space: pre-wrap; word-break: break-word; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
