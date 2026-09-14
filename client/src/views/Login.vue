<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">📊 梦幻竞彩家</div>
      <h1>登录账户</h1>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="form.email" type="email" placeholder="输入邮箱" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="form.password" type="password" placeholder="输入密码" required />
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
      <div class="auth-footer">
        还没有账户？ <router-link to="/register">立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const form = ref({ email: '', password: '' })
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await api.post('/auth/login', form.value)
    auth.setAuth(data.token, data.user)
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    router.push(redirect || '/')
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0D1117; padding: 24px; }
.auth-card { background: #161B22; border: 1px solid #21262D; border-radius: 16px; padding: 40px; width: 100%; max-width: 400px; }
.auth-logo { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #58A6FF; }
.auth-card h1 { text-align: center; font-size: 20px; margin-bottom: 28px; color: #E6EDF3; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 13px; color: #8B949E; margin-bottom: 6px; }
.form-group input { width: 100%; padding: 10px 12px; background: #0D1117; border: 1px solid #30363D; border-radius: 8px; color: #E6EDF3; font-size: 14px; outline: none; transition: border-color 0.2s; }
.form-group input:focus { border-color: #58A6FF; }
.error-msg { background: rgba(248,81,73,0.1); border: 1px solid #F85149; border-radius: 8px; padding: 10px; color: #F85149; font-size: 13px; margin-bottom: 16px; }
.btn-block { width: 100%; padding: 12px; font-size: 15px; margin-top: 8px; }
.btn-primary { background: #58A6FF; color: #0D1117; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-footer { text-align: center; margin-top: 20px; font-size: 13px; color: #8B949E; }
</style>
