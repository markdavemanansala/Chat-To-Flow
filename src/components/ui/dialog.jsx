import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

const DialogContext = React.createContext()

export function Dialog({ open, onOpenChange, children }) {
  const [isOpen, setIsOpen] = React.useState(open ?? false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open)
  }, [open])

  const handleOpenChange = React.useCallback((newOpen) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }, [onOpenChange])

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const dialogContent = (
    <DialogContext.Provider value={{ open: isOpen, onOpenChange: handleOpenChange }}>
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
        <div 
          className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
          onClick={() => handleOpenChange(false)}
          style={{ pointerEvents: 'auto' }}
        />
        <div className="relative z-[101]" style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  )

  // Render to document.body using portal to ensure it's above everything
  return createPortal(dialogContent, document.body)
}

export function DialogContent({ className, children, ...props }) {
  const { onOpenChange } = React.useContext(DialogContext)
  
  return (
    <div
      className={cn(
        "relative bg-background rounded-lg border shadow-lg p-6 max-w-lg w-full max-h-[90vh]",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      <button
        onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 z-[102] rounded-sm opacity-70 hover:opacity-100 text-muted-foreground"
        aria-label="Close"
      >
        ✕
      </button>
      {children}
    </div>
  )
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 mb-4", className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <h2
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }) {
  return (
    <p
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)}
      {...props}
    />
  )
}
