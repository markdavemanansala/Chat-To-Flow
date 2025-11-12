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
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <Link to="/" className="text-xl sm:text-2xl font-bold hover:opacity-80 transition-opacity">
              AI Agent Builder
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Link to="/workflows" className="flex-1 sm:flex-initial">
                <Button variant="ghost" className="w-full sm:w-auto text-sm sm:text-base">My Workflows</Button>
              </Link>
              <Link to="/templates" className="flex-1 sm:flex-initial">
                <Button variant="ghost" className="w-full sm:w-auto text-sm sm:text-base">Templates</Button>
              </Link>
              <Link to="/chat" className="flex-1 sm:flex-initial">
                <Button variant="ghost" className="w-full sm:w-auto text-sm sm:text-base">Chat</Button>
              </Link>
              <select
                value={currentLocale}
                onChange={(e) => handleLocaleChange(e.target.value)}
                className="px-2 py-1.5 text-xs sm:text-sm border rounded bg-background text-foreground [&>option]:bg-background [&>option]:text-foreground"
              >
                <option value="en">🇺🇸 EN</option>
                <option value="tl">🇵🇭 TL</option>
                <option value="vi">🇻🇳 VI</option>
              </select>
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleTheme}
                className="text-sm sm:text-base"
              >
                {isDark ? '☀️' : '🌙'}
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet context={{ locale: currentLocale }} />
      </main>
    </div>
  )
}
