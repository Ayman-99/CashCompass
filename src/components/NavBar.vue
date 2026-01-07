<template>
  <nav class="navbar">
    <div class="container">
      <div class="nav-content">
        <div class="nav-brand">
          <router-link to="/dashboard">💰 Finance App</router-link>
        </div>
        <button @click="toggleMobileMenu" class="mobile-menu-toggle" :class="{ active: mobileMenuOpen }" aria-label="Toggle menu">
          <span class="hamburger"></span>
          <span class="hamburger"></span>
          <span class="hamburger"></span>
        </button>
        <div class="nav-links" :class="{ 'mobile-open': mobileMenuOpen }">
          <router-link to="/dashboard" @click="closeMobileMenu">Dashboard</router-link>
          <router-link to="/transactions" @click="closeMobileMenu">Transactions</router-link>
          <router-link to="/accounts" @click="closeMobileMenu">Accounts</router-link>
          <router-link to="/categories" @click="closeMobileMenu">Categories</router-link>
          <router-link to="/currencies" @click="closeMobileMenu">Currencies</router-link>
          <router-link to="/admin" v-if="authStore.user" @click="closeMobileMenu">Admin</router-link>
          <router-link to="/audit" @click="closeMobileMenu">Audit</router-link>
          <router-link to="/settings" @click="closeMobileMenu">Settings</router-link>
          <button @click="toggleTheme" class="theme-toggle" :title="themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
            {{ themeStore.isDark ? '☀️' : '🌙' }}
          </button>
          <button @click="handleLogout" class="btn btn-secondary">Logout</button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const router = useRouter()
const mobileMenuOpen = ref(false)

const toggleTheme = () => {
  themeStore.toggle()
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
  closeMobileMenu()
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

// Close menu when clicking outside
const handleClickOutside = (event) => {
  if (mobileMenuOpen.value && !event.target.closest('.navbar')) {
    closeMobileMenu()
  }
}

// Close menu on route change
router.afterEach(() => {
  closeMobileMenu()
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.navbar {
  background-color: var(--nav-bg);
  box-shadow: 0 2px 4px var(--nav-shadow);
  padding: 16px 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  animation: slideInDown 0.3s ease-out;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand a {
  font-size: 20px;
  font-weight: bold;
  color: var(--link-color);
  text-decoration: none;
  transition: color 0.3s ease;
}

.nav-brand a:hover {
  color: var(--link-hover);
}

.nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.nav-links a {
  color: var(--nav-text);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  padding: 4px 8px;
  border-radius: 4px;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  width: 0;
  height: 2px;
  background: var(--link-color);
  transition: all 0.3s ease;
  transform: translateX(-50%);
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: var(--link-color);
  background: rgba(0, 123, 255, 0.1);
}

[data-theme="dark"] .nav-links a:hover,
[data-theme="dark"] .nav-links a.router-link-active {
  background: rgba(88, 166, 255, 0.1);
}

.nav-links a.router-link-active::after,
.nav-links a:hover::after {
  width: 80%;
}

.nav-links .btn {
  margin-left: 10px;
  padding: 8px 16px;
  font-size: 14px;
}

.theme-toggle {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  margin-left: 10px;
  transition: all 0.3s ease;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  transform: scale(1.15) rotate(15deg);
  background: var(--bg-tertiary);
}

.theme-toggle:active {
  transform: scale(0.95) rotate(-15deg);
}

/* Mobile Menu Toggle */
.mobile-menu-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  z-index: 1001;
}

.hamburger {
  width: 25px;
  height: 3px;
  background: var(--nav-text);
  border-radius: 2px;
  transition: all 0.3s ease;
}

.mobile-menu-toggle:hover .hamburger {
  background: var(--link-color);
}

/* Mobile Styles */
@media (max-width: 768px) {
  .mobile-menu-toggle {
    display: flex;
  }
  
  .nav-links {
    position: fixed;
    top: 0;
    right: -100%;
    width: 280px;
    height: 100vh;
    background: var(--nav-bg);
    box-shadow: -2px 0 10px var(--nav-shadow);
    flex-direction: column;
    align-items: flex-start;
    padding: 80px 20px 20px;
    gap: 0;
    transition: right 0.3s ease;
    z-index: 1000;
    overflow-y: auto;
  }
  
  .nav-links.mobile-open {
    right: 0;
  }
  
  .nav-links a {
    width: 100%;
    padding: 16px;
    border-bottom: 1px solid var(--border-color);
    border-radius: 0;
    margin: 0;
  }
  
  .nav-links a::after {
    display: none;
  }
  
  .nav-links .btn {
    width: 100%;
    margin: 16px 0 0 0;
    padding: 12px;
  }
  
  .theme-toggle {
    width: 100%;
    margin: 16px 0 0 0;
    padding: 12px;
    justify-content: flex-start;
    border-bottom: 1px solid var(--border-color);
    border-radius: 0;
  }
  
  /* Hamburger animation */
  .mobile-menu-toggle.active .hamburger:nth-child(1) {
    transform: rotate(45deg) translate(8px, 8px);
  }
  
  .mobile-menu-toggle.active .hamburger:nth-child(2) {
    opacity: 0;
  }
  
  .mobile-menu-toggle.active .hamburger:nth-child(3) {
    transform: rotate(-45deg) translate(7px, -7px);
  }
  
  /* Overlay when menu is open */
  .nav-links.mobile-open::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: -1;
  }
}

@media (max-width: 480px) {
  .nav-links {
    width: 100%;
    right: -100%;
  }
  
  .nav-brand a {
    font-size: 18px;
  }
}
</style>

