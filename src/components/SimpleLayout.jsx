import { useState, useEffect } from "react"
import { Outlet } from "react-router-dom"
import { Link } from "react-router-dom"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { getCurrentLocale, setLocale } from "@/i18n"

export function SimpleLayout() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  const [currentLocale, setCurrentLocaleState] = useState(() => getCurrentLocale())

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark(!isDark)

  const handleLocaleChange = (newLocale) => {
    setLocale(newLocale)
    setCurrentLocaleState(newLocale)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" key={currentLocale}>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
            AI Agent Builder
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/workflows">
              <Button variant="ghost">My Workflows</Button>
            </Link>
            <Link to="/templates">
              <Button variant="ghost">Templates</Button>
            </Link>
            <Link to="/chat">
              <Button variant="ghost">Chat</Button>
            </Link>
            <select
              value={currentLocale}
              onChange={(e) => handleLocaleChange(e.target.value)}
              className="px-2 py-1 text-sm border rounded bg-background text-foreground [&>option]:bg-background [&>option]:text-foreground"
            >
              <option value="en">🇺🇸 EN</option>
              <option value="tl">🇵🇭 TL</option>
              <option value="vi">🇻🇳 VI</option>
            </select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={toggleTheme}
            >
              {isDark ? '☀️' : '🌙'}
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet context={{ locale: currentLocale }} />
      </main>
    </div>
  )
}
