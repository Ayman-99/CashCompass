<template>
  <div id="app">
    <NavBar v-if="authStore.isAuthenticated" />
    <router-view v-slot="{ Component, route }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import NavBar from './components/NavBar.vue'

const authStore = useAuthStore()
</script>

<style scoped>
#app {
  min-height: 100vh;
}

/* Page Transition Animations */
.page-enter-active {
  animation: fadeIn 0.3s ease-out;
}

.page-leave-active {
  animation: fadeIn 0.2s ease-in reverse;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

