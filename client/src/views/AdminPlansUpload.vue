<template>
  <div class="page">
    <div class="page-header">
      <router-link to="/admin" class="back-link">← 管理后台</router-link>
      <h1>📦 方案上传</h1>
      <p>上传付费解锁的推荐方案，所有数据先存为草稿，确认后点击单独发布</p>
    </div>

    <div class="upload-tabs">
      <button :class="{ active: tab === 'file' }" @click="tab = 'file'">📁 文件批量导入</button>
      <button :class="{ active: tab === 'manual' }" @click="tab = 'manual'">✏️ 手动录入</button>
    </div>

    <div v-if="tab === 'file'" class="upload-card">
      <h3>批量导入方案</h3>
      <p>支持 CSV / JSON，字段：plan_id, title, content, sweep_record_id（可选关联扫盘）, result</p>
      <div class="file-area" @dragover.prevent @drop.prevent="handleDrop" @click="$refs.fileInput.click()">
        <input ref="fileInput" type="file" accept=".csv,.json" @change="handleFile" style="display:none" />
        <div class="fa-icon">📂</div>
        <div>拖拽文件到此处，或点击选择文件</div>
        <div class="fa-hint">所有数据默认保存为草稿</div>
      </div>
      <div v-if="uploadResult" class="result-msg" :class="uploadResult.error ? 'error' : 'success'">{{ uploadResult.message }}</div>
    </div>

    <div v-if="tab === 'manual'" class="upload-card">
      <h3>新增方案草稿</h3>
      <div class="form-row">
        <div class="form-group">
          <label>所属方案</label>
          <select v-model="form.plan_id">
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="form-group"><label>方案标题</label><input v-model="form.title" required placeholder="如：周末精选 5 串 1" /></div>
        <div class="form-group"><label>关联扫盘ID（可选）</label><input v-model="form.sweep_record_id" placeholder="扫盘记录ID" /></div>
      </div>
      <div class="form-group">
        <label>方案说明 / 分析逻辑</label>
        <textarea v-model="form.content" rows="4" placeholder="详细分析逻辑、推荐理由、组合方式..."></textarea>
      </div>
      <div v-if="submitMsg" class="result-msg" :class="submitMsg.error ? 'error' : 'success'">{{ submitMsg.text }}</div>
      <button type="button" @click="submitDraft" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? '保存中...' : '💾 保存为草稿' }}
      </button>
    </div>

    <!-- 草稿列表 -->
    <div class="drafts-section">
      <div class="drafts-header">
        <h3>方案管理</h3>
        <div class="filter-tabs">
          <button :class="{ active: filter === 'all' }" @click="filter = 'all'; loadItems()">全部 ({{ counts.all }})</button>
          <button :class="{ active: filter === 'pending' }" @click="filter = 'pending'; loadItems()">📝 草稿 ({{ counts.pending }})</button>
          <button :class="{ active: filter === 'published' }" @click="filter = 'published'; loadItems()">✅ 已发布 ({{ counts.published }})</button>
        </div>
      </div>
      <div class="drafts-list" v-if="items.length">
        <div class="draft-item" v-for="it in items" :key="it.id" :class="{ published: it.published_at }">
          <div class="di-main">
            <div class="di-title">
              {{ it.title }}
              <span v-if="it.published_at" class="badge published">✅ 已发布</span>
              <span v-else class="badge draft">📝 草稿</span>
            </div>
            <div class="di-content">{{ it.content }}</div>
            <div class="di-meta">
              <span class="mono">📦 {{ it.plan_name }}</span>
              <span v-if="it.published_at" class="mono">发布: {{ formatDate(it.published_at) }}</span>
              <span v-else class="mono warning">未发布</span>
              <span class="mono">更新: {{ formatDate(it.updated_at) }}</span>
            </div>
          </div>
          <div class="di-actions">
            <button v-if="!it.published_at" @click="publish(it.id)" class="btn btn-primary btn-sm">发布</button>
            <button v-else @click="unpublish(it.id)" class="btn btn-ghost btn-sm">撤回</button>
            <button @click="editItem(it)" class="btn btn-ghost btn-sm">编辑</button>
            <button @click="removeItem(it.id)" class="btn btn-ghost btn-sm danger">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty">暂无方案</div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editing" class="modal-mask" @click.self="editing = null">
      <div class="modal">
        <h3>编辑方案</h3>
        <div class="form-group">
          <label>所属方案</label>
          <select v-model="editForm.plan_id">
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="form-group"><label>方案标题</label><input v-model="editForm.title" required /></div>
        <div class="form-group"><label>方案说明</label><textarea v-model="editForm.content" rows="4"></textarea></div>
        <div class="form-group"><label>结果</label>
          <select v-model="editForm.result">
            <option value="pending">⏳ 待定</option><option value="win">✅ 红</option><option value="loss">❌ 黑</option><option value="push">🔄 走</option>
          </select>
        </div>
        <div class="modal-actions">
          <button @click="saveEdit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存修改' }}</button>
          <button @click="editing = null" class="btn btn-ghost">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { api } from '@/stores/auth'

const tab = ref('file')
const plans = ref([])
const form = ref({ plan_id: '', title: '', content: '', sweep_record_id: '' })
const submitting = ref(false)
const submitMsg = ref(null)
const uploadResult = ref(null)
const items = ref([])
const filter = ref('all')
const counts = ref({ all: 0, pending: 0, published: 0 })

const editing = ref(null)
const editForm = ref({ plan_id: '', title: '', content: '', result: 'pending' })
const saving = ref(false)

async function loadPlans() {
  try { const { data } = await api.get('/admin/plans'); plans.value = data.plans; if (data.plans.length && !form.value.plan_id) form.value.plan_id = data.plans[0].id }
  catch (e) { console.error(e) }
}

async function loadItems() {
  try {
    const statusParam = filter.value === 'all' ? null : filter.value;
    const { data } = await api.get('/admin/recommendations', { params: { status: statusParam || undefined } });
    items.value = data.items;
    const { data: allData } = await api.get('/admin/recommendations');
    const { data: pendData } = await api.get('/admin/recommendations', { params: { status: 'pending' } });
    const { data: pubData } = await api.get('/admin/recommendations', { params: { status: 'published' } });
    counts.value = { all: allData.items.length, pending: pendData.items.length, published: pubData.items.length };
  } catch (e) { console.error(e) }
}

async function submitDraft() {
  submitting.value = true; submitMsg.value = null
  try {
    await api.post('/admin/recommendation', form.value)
    submitMsg.value = { text: '已保存为草稿，可点击"发布"上线', error: false }
    form.value.title = ''; form.value.content = ''; form.value.sweep_record_id = ''
    await loadItems()
  } catch (e) { submitMsg.value = { text: e.response?.data?.error || '保存失败', error: true } }
  finally { submitting.value = false }
}

async function publish(id) {
  if (!confirm('确认发布此方案？发布后会员可查看。')) return
  try { await api.post(`/admin/recommendation/${id}/publish`); await loadItems() }
  catch (e) { alert('发布失败: ' + e.message) }
}

async function unpublish(id) {
  if (!confirm('确认撤回为草稿？会员将无法查看。')) return
  try { await api.post(`/admin/recommendation/${id}/unpublish`, {}); await loadItems() }
  catch (e) { alert('撤回失败: ' + e.message) }
}

function editItem(it) {
  editing.value = it.id
  editForm.value = { plan_id: it.plan_id, title: it.title, content: it.content || '', result: it.result }
}

async function saveEdit() {
  saving.value = true
  try {
    await api.put(`/admin/recommendation/${editing.value}`, editForm.value)
    editing.value = null
    await loadItems()
  } catch (e) { alert('保存失败: ' + e.message) }
  finally { saving.value = false }
}

async function removeItem(id) {
  if (!confirm('确认删除？此操作不可恢复。')) return
  try { await api.delete(`/admin/recommendation/${id}`); await loadItems() }
  catch (e) { alert('删除失败: ' + e.message) }
}

async function handleFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const fd = new FormData(); fd.append('file', file)
  try {
    const { data } = await api.post('/admin/upload/plan', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    uploadResult.value = { message: data.message, error: false }; await loadItems()
  } catch (e) { uploadResult.value = { message: e.response?.data?.error || '上传失败', error: true } }
}

function handleDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file) handleFile({ target: { files: [file] } })
}

function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) }

onMounted(async () => { await loadPlans(); await loadItems() })
</script>

<style scoped>
.page { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
.back-link { color: #58A6FF; font-size: 13px; display: inline-block; margin-bottom: 8px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }

.upload-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
.upload-tabs button { padding: 10px 20px; border-radius: 8px; border: 1px solid #30363D; background: transparent; color: #8B949E; cursor: pointer; font-size: 14px; }
.upload-tabs button.active { background: #58A6FF; color: #0D1117; border-color: #58A6FF; font-weight: 600; }

.upload-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
.upload-card h3 { font-size: 15px; margin-bottom: 12px; }
.upload-card > p { font-size: 13px; color: #8B949E; margin-bottom: 16px; line-height: 1.6; }

.form-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.form-group label { font-size: 12px; color: #8B949E; }
.form-group input, .form-group select, .form-group textarea { padding: 9px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; font-family: inherit; }
.form-group textarea { resize: vertical; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #58A6FF; }

.file-area { border: 2px dashed #30363D; border-radius: 12px; padding: 40px; text-align: center; cursor: pointer; transition: border-color 0.2s; color: #8B949E; font-size: 14px; }
.file-area:hover { border-color: #58A6FF; color: #E6EDF3; }
.fa-icon { font-size: 36px; margin-bottom: 8px; }
.fa-hint { font-size: 12px; color: #30363D; margin-top: 4px; }

.result-msg { padding: 12px; border-radius: 8px; font-size: 13px; margin: 12px 0; }
.result-msg.success { background: rgba(63,185,80,0.1); border: 1px solid #3FB950; color: #3FB950; }
.result-msg.error { background: rgba(248,81,73,0.1); border: 1px solid #F85149; color: #F85149; }

.drafts-section { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.drafts-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.drafts-header h3 { font-size: 15px; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tabs button { padding: 6px 14px; border-radius: 6px; border: 1px solid #30363D; background: transparent; color: #8B949E; cursor: pointer; font-size: 13px; }
.filter-tabs button.active { background: #21262D; color: #58A6FF; border-color: #58A6FF; }

.drafts-list { display: flex; flex-direction: column; gap: 12px; }
.draft-item { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px; background: #0D1117; border: 1px solid #21262D; border-radius: 10px; transition: all 0.15s; }
.draft-item.published { border-color: rgba(63, 185, 80, 0.3); }
.draft-item:hover { border-color: #30363D; }
.di-main { flex: 1; }
.di-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; }
.di-content { font-size: 13px; color: #8B949E; margin-bottom: 8px; line-height: 1.5; }
.di-meta { display: flex; gap: 16px; font-size: 11px; color: #8B949E; flex-wrap: wrap; }
.di-meta .warning { color: #F0883E; }

.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.badge.draft { background: rgba(240, 136, 62, 0.15); color: #F0883E; }
.badge.published { background: rgba(63, 185, 80, 0.15); color: #3FB950; }

.di-actions { display: flex; gap: 8px; flex-shrink: 0; }

.empty { text-align: center; color: #8B949E; padding: 40px; }

.btn { display: inline-flex; align-items: center; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.15s; }
.btn-sm { padding: 6px 12px; font-size: 13px; }
.btn-primary { background: #58A6FF; color: #0D1117; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; }
.btn-ghost:hover { border-color: #58A6FF; color: #58A6FF; }
.btn-ghost.danger:hover { color: #F85149; border-color: #F85149; }

/* Modal */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #161B22; border: 1px solid #30363D; border-radius: 12px; padding: 24px; width: 90%; max-width: 500px; }
.modal h3 { font-size: 16px; margin-bottom: 16px; }
.modal-actions { display: flex; gap: 12px; margin-top: 16px; }
.mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
</style>