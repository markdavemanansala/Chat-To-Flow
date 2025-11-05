import * as React from "react"
import { cn } from "@/lib/utils"

export function Toast({ children, variant = "default", onClose, ...props }) {
  const [isVisible, setIsVisible] = React.useState(true)

  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5",
        variant === "default" && "bg-background text-foreground",
        variant === "success" && "bg-green-50 border-green-200 text-green-900 dark:bg-primary/20 dark:border-primary/40 dark:text-primary-foreground",
        variant === "error" && "bg-red-50 border-red-200 text-red-900 dark:bg-destructive/20 dark:border-destructive/40 dark:text-destructive-foreground"
      )}
      {...props}
    >
      {children}
    </div>
  )
}

