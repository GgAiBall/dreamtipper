<template>
  <div class="page">
    <div class="page-header">
      <h1>⚙️ 个人设置</h1>
    </div>
    <div class="profile-card">
      <form @submit.prevent="saveProfile">
        <div class="form-group"><label>昵称</label><input v-model="form.nickname" required /></div>
        <div class="form-group"><label>邮箱</label><input :value="auth.user?.email" disabled /></div>
        <div v-if="msg" class="msg" :class="msg.error ? 'error' : 'success'">{{ msg.text }}</div>
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/stores/auth'
const auth = useAuthStore()
const form = ref({ nickname: '' })
const saving = ref(false)
const msg = ref(null)
async function saveProfile() {
  saving.value = true; msg.value = null
  try {
    await api.put('/auth/profile', { nickname: form.value.nickname })
    await auth.fetchMe()
    msg.value = { text: '保存成功', error: false }
  } catch (e) { msg.value = { text: '保存失败', error: true } }
  finally { saving.value = false }
}
onMounted(() => { form.value.nickname = auth.user?.nickname || '' })
</script>

<style scoped>
.page { max-width: 600px; margin: 0 auto; padding: 40px 24px; }
.page-header h1 { font-size: 28px; margin-bottom: 24px; }
.profile-card { background: #161B22; border: 1px solid #21262D; border-radius: 12px; padding: 24px; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.form-group label { font-size: 13px; color: #8B949E; }
.form-group input { padding: 10px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; }
.form-group input:focus { border-color: #58A6FF; }
.form-group input:disabled { opacity: 0.5; }
.msg { padding: 10px 12px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
.msg.success { background: rgba(63,185,80,0.1); border: 1px solid #3FB950; color: #3FB950; }
.msg.error { background: rgba(248,81,73,0.1); border: 1px solid #F85149; color: #F85149; }
.btn { padding: 10px 24px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; background: #58A6FF; color: #0D1117; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
