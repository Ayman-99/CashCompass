import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/transactions',
      name: 'Transactions',
      component: () => import('../views/Transactions.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/accounts',
      name: 'Accounts',
      component: () => import('../views/Accounts.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/categories',
      name: 'Categories',
      component: () => import('../views/Categories.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('../views/Admin.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/Settings.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/audit',
      name: 'Audit',
      component: () => import('../views/Audit.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/currencies',
      name: 'Currencies',
      component: () => import('../views/Currencies.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Try to check auth status
      const isAuth = await authStore.checkAuth()
      if (!isAuth) {
        next('/login')
        return
      }
    }
  }
  
  if (to.path === '/login' && authStore.isAuthenticated) {
    next('/dashboard')
    return
  }
  
  next()
})

export default router

