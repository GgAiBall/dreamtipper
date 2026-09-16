<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>📡 实时分析管理</h1>
      <p>上传赛事实时分析内容，前台「实时分析」界面展示。所有内容先保存，可随时修改或删除。</p>
    </div>

    <div class="layout">
      <!-- 编辑区 -->
      <div class="editor-card">
        <h3>{{ editingId ? '✏️ 修改分析文章' : '➕ 新增分析文章' }}</h3>
        <div class="form-group"><label>标题</label><input v-model="form.title" placeholder="如：周三英超焦点战前瞻" /></div>
        <div class="form-row">
          <div class="form-group"><label>分类</label>
            <select v-model="form.category">
              <option value="实时分析">实时分析</option>
              <option value="赛前分析">赛前分析</option>
              <option value="深度拆解">深度拆解</option>
            </select>
          </div>
          <div class="form-group"><label>可见权限</label>
            <select v-model="form.tier_required">
              <option value="free">🆓 免费可见</option><option value="monthly">💎 月度可见</option><option value="yearly">👑 年度可见</option>
            </select>
          </div>
        </div>
        <div class="form-group"><label>封面图 URL（可选）</label><input v-model="form.image_url" placeholder="https://... 留空无封面" /></div>
        <div class="form-group"><label>正文内容</label>
          <textarea v-model="form.content" rows="10" placeholder="支持纯文本，回车分段。可粘贴赛前观点、数据拆解、推荐理由等。"></textarea>
        </div>
        <div class="editor-actions">
          <button @click="save" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : (editingId ? '💾 保存修改' : '📤 发布文章') }}</button>
          <button v-if="editingId" @click="resetForm" class="btn btn-ghost">取消修改</button>
        </div>
      </div>

      <!-- 列表区 -->
      <div class="list-card">
        <h3>📋 已发布文章 ({{ posts.length }})</h3>
        <div v-if="posts.length === 0" class="empty">暂无文章</div>
        <div class="post-item" v-for="p in posts" :key="p.id">
          <div class="post-info">
            <span class="cat-tag" :class="catClass(p.category)">{{ p.category }}</span>
            <span class="post-title">{{ p.title }}</span>
            <span class="mono time">{{ formatDate(p.created_at) }}</span>
          </div>
          <div class="post-actions">
            <button @click="editPost(p)" class="btn btn-ghost btn-sm">✏️ 修改</button>
            <button @click="removePost(p.id)" class="btn btn-ghost btn-sm danger">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/stores/auth'

const posts = ref([])
const saving = ref(false)
const editingId = ref(null)
const form = ref({ title: '', category: '实时分析', tier_required: 'free', image_url: '', content: '' })

function catClass(c) {
  return { '实时分析': 'cat-manual', '赛前分析': 'cat-ai', '深度拆解': 'cat-god' }[c] || 'cat-other'
}
function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d.replace(' ', 'T'))
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function resetForm() {
  editingId.value = null
  form.value = { title: '', category: '实时分析', tier_required: 'free', image_url: '', content: '' }
}

async function loadPosts() {
  try { const { data } = await api.get('/admin/analysis'); posts.value = data.posts || [] } catch (e) { console.error(e) }
}

async function save() {
  if (!form.value.title.trim() || !form.value.content.trim()) { alert('标题与正文为必填'); return }
  saving.value = true
  try {
    if (editingId.value) {
      await api.put(`/admin/analysis/${editingId.value}`, form.value)
    } else {
      await api.post('/admin/analysis', form.value)
    }
    resetForm()
    await loadPosts()
  } catch (e) { alert('保存失败: ' + (e.response?.data?.error || e.message)) }
  finally { saving.value = false }
}

function editPost(p) {
  editingId.value = p.id
  form.value = { title: p.title, category: p.category || '实时分析', tier_required: p.tier_required || 'free', image_url: p.image_url || '', content: p.content || '' }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function removePost(id) {
  if (!confirm('确认删除该文章？不可恢复。')) return
  try { await api.delete(`/admin/analysis/${id}`); await loadPosts() } catch (e) { alert('删除失败: ' + e.message) }
}

onMounted(loadPosts)
</script>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; margin-bottom: 24px; }
.layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

.editor-card, .list-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.editor-card h3, .list-card h3 { font-size: 15px; margin-bottom: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.form-group label { font-size: 12px; color: #8B949E; }
.form-group input, .form-group select, .form-group textarea { padding: 9px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; font-family: inherit; }
.form-group textarea { resize: vertical; line-height: 1.6; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.editor-actions { display: flex; gap: 12px; margin-top: 8px; }

.post-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid #21262D; }
.post-item:last-child { border-bottom: none; }
.post-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.post-title { font-size: 14px; font-weight: 600; }
.cat-tag { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.cat-manual { background: rgba(88,166,255,0.15); color: #58A6FF; }
.cat-ai { background: rgba(163,113,247,0.15); color: #A371F7; }
.cat-god { background: rgba(255,191,46,0.15); color: #FFBF2E; }
.cat-other { background: rgba(139,148,158,0.15); color: #8B949E; }
.post-actions { display: flex; gap: 6px; }
.empty { color: #8B949E; padding: 20px 0; text-align: center; }

.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-sm { padding: 6px 10px; font-size: 12px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { border-color: #58A6FF; color: #58A6FF; }
.btn-ghost.danger:hover { color: #F85149; border-color: #F85149; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
