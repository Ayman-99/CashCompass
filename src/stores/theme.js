import { defineStore } from 'pinia'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: localStorage.getItem('theme') === 'dark' || 
            (localStorage.getItem('theme') === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
  }),

  getters: {
    theme: (state) => state.isDark ? 'dark' : 'light'
  },

  actions: {
    toggle() {
      this.isDark = !this.isDark
      this.applyTheme()
    },

    setDark() {
      this.isDark = true
      this.applyTheme()
    },

    setLight() {
      this.isDark = false
      this.applyTheme()
    },

    applyTheme() {
      localStorage.setItem('theme', this.isDark ? 'dark' : 'light')
      if (this.isDark) {
        document.documentElement.setAttribute('data-theme', 'dark')
      } else {
        document.documentElement.removeAttribute('data-theme')
      }
    }
  }
})

