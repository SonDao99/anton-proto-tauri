export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function getTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {}
  return prefersDark() ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  try {
    const el = document.documentElement
    if (!el) return
    if (theme === 'dark') {
      el.classList.add('dark')
    } else {
      el.classList.remove('dark')
    }
  } catch {}
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
  applyTheme(theme)
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}

// Initialize theme on module load
;(function init() {
  applyTheme(getTheme())
})()
