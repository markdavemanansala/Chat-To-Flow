import { useState, createContext, useContext } from "react"
import { Toast } from "./ui/toast"

const ToastContext = createContext()

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)

  const showToast = (message, variant = "default") => {
    setToast({ message, variant, id: Date.now() })
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          variant={toast.variant}
          onClose={() => setToast(null)}
        >
          {toast.message}
        </Toast>
      )}
    </ToastContext.Provider>
  )
}

