import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', name: 'Home', component: () => import('@/views/Home.vue') },
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue') },
  { path: '/register', name: 'Register', component: () => import('@/views/Register.vue') },
  { path: '/data', name: 'Data', component: () => import('@/views/Data.vue') },
  { path: '/plans', name: 'Plans', component: () => import('@/views/Plans.vue') },
  { path: '/plans/:id', name: 'PlanDetail', component: () => import('@/views/PlanDetail.vue') },
  { path: '/stats', name: 'Stats', component: () => import('@/views/Stats.vue') },
  { path: '/dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { requiresAuth: true } },
  { path: '/admin', name: 'Admin', component: () => import('@/views/Admin.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/upload', name: 'AdminUpload', component: () => import('@/views/AdminUpload.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/plans-upload', name: 'AdminPlansUpload', component: () => import('@/views/AdminPlansUpload.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/members', name: 'AdminMembers', component: () => import('@/views/AdminMembers.vue'), meta: { requiresAdmin: true } },
  { path: '/admin/plans', name: 'AdminPlans', component: () => import('@/views/AdminPlans.vue'), meta: { requiresAdmin: true } },
  { path: '/profile', name: 'Profile', component: () => import('@/views/Profile.vue'), meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.meta.requiresAdmin && auth.user?.role !== 'admin') {
    next({ name: 'Home' })
  } else {
    next()
  }
})

export default router
