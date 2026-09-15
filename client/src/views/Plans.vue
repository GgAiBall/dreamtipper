<template>
  <div class="page">
    <div class="page-header">
      <h1>📋 方案市场</h1>
      <p>选择适合您的订阅方案，解锁专属分析方案和深度数据</p>
    </div>

    <div class="tier-section">
      <h3>💎 会员订阅</h3>
      <div class="plans-grid">
        <div class="plan-card" :class="{ recommended: p.tier_required === 'monthly' }" v-for="p in subscriptionPlans" :key="p.id">
          <div v-if="p.tier_required === 'monthly'" class="plan-badge">推荐</div>
          <div class="plan-name">{{ p.name }}</div>
          <div class="plan-price mono">
            <span class="price">¥{{ (p.price / 100).toFixed(0) }}</span>
            <span class="period">/{{ p.price >= 50000 ? '年' : '月' }}</span>
          </div>
          <div class="plan-desc">{{ p.description }}</div>
          <div class="plan-stats" v-if="p.stats">
            <div class="ps-item"><span>胜率</span><strong class="mono">{{ p.stats.win_rate || 0 }}%</strong></div>
            <div class="ps-item"><span>总场次</span><strong class="mono">{{ p.stats.total || 0 }}</strong></div>
          </div>
          <div class="plan-actions">
            <button v-if="auth.tier === p.tier_required" class="btn btn-active" disabled>当前方案</button>
            <button v-else-if="auth.tier === 'yearly'" class="btn btn-ghost" disabled>已享受更优方案</button>
            <button v-else class="btn btn-primary btn-disabled" disabled>联系管理员购买</button>
          </div>
        </div>
      </div>
    </div>

    <div class="tier-section">
      <h3>🎯 单次方案解锁</h3>
      <div class="plans-grid">
        <div class="plan-card" v-for="p in unlockPlans" :key="p.id">
          <div class="plan-name">{{ p.name }}</div>
          <div class="plan-price mono">¥{{ (p.price / 100).toFixed(0) }}<span class="period">/次</span></div>
          <div class="plan-desc">{{ p.description }}</div>
          <div class="plan-stats" v-if="p.stats">
            <span class="mono">{{ p.stats.wins || 0 }}胜 {{ p.stats.losses || 0 }}负</span>
            <span>{{ p.subscriber_count }}人解锁</span>
          </div>
          <div class="plan-actions">
            <router-link :to="`/plans/${p.id}`" class="btn btn-ghost">查看详情</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const plans = ref([])

const subscriptionPlans = computed(() => plans.value.filter(p => p.price > 0))
const unlockPlans = computed(() => plans.value.filter(p => p.price === 0 || !p.price))

onMounted(async () => {
  const { data } = await api.get('/plans')
  plans.value = data.plans
})
</script>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.page-header { margin-bottom: 32px; }
.page-header h1 { font-size: 28px; margin-bottom: 8px; }
.page-header p { color: #8B949E; font-size: 14px; }
.tier-section { margin-bottom: 48px; }
.tier-section h3 { font-size: 18px; margin-bottom: 16px; color: #E6EDF3; }
.plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.plan-card { background: #161B22; border: 1px solid #21262D; border-radius: 16px; padding: 24px; position: relative; transition: border-color 0.2s; }
.plan-card:hover { border-color: #30363D; }
.plan-card.recommended { border-color: #58A6FF; background: rgba(88,166,255,0.05); }
.plan-badge { position: absolute; top: -10px; right: 16px; background: #58A6FF; color: #0D1117; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
.plan-name { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
.plan-price { font-size: 32px; font-weight: 700; color: #3FB950; margin-bottom: 8px; }
.plan-price .period { font-size: 14px; color: #8B949E; font-weight: 400; }
.plan-desc { font-size: 13px; color: #8B949E; margin-bottom: 16px; line-height: 1.6; }
.plan-stats { display: flex; gap: 16px; font-size: 12px; color: #58A6FF; margin-bottom: 16px; }
.plan-stats strong { font-size: 16px; color: #E6EDF3; }
.plan-actions { margin-top: 12px; }
.btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
.btn-primary { background: #58A6FF; color: #0D1117; width: 100%; justify-content: center; }
.btn-ghost { background: transparent; color: #8B949E; border: 1px solid #30363D; width: 100%; justify-content: center; }
.btn-active { background: rgba(63,185,80,0.15); color: #3FB950; border: 1px solid #3FB950; width: 100%; justify-content: center; cursor: default; }
.btn-disabled { background: rgba(139,148,158,0.1); color: #8B949E; border: 1px solid #30363D; width: 100%; justify-content: center; cursor: not-allowed; opacity: 0.7; }
.mono { font-family: 'JetBrains Mono', monospace; }
</style>
