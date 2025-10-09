import React from 'react'
import { Button } from './ui/button'
import { getTheme, toggleTheme, type Theme } from '../lib/theme'

function ThemeToggle() {
  const [theme, setThemeState] = React.useState<Theme>(() => getTheme())

  const onToggle = () => {
    toggleTheme()
    setThemeState(getTheme())
  }

  const isDark = theme === 'dark'

  return (
    <div className="inline-flex items-center">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? '🌙 Dark' : '☀️ Light'}
      </Button>
    </div>
  )
}

export default ThemeToggle
