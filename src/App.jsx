import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ToastProvider } from "./components/ToastProvider"
import { SimpleLayout } from "./components/SimpleLayout"
import { Home } from "./pages/Home"
import { Templates } from "./pages/Templates"
import { Chat } from "./pages/Chat"
import { Preview } from "./pages/Preview"
import Builder from "./pages/Builder"
import { MyWorkflows } from "./pages/MyWorkflows"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<SimpleLayout />}>
              <Route index element={<Home />} />
              <Route path="workflows" element={<MyWorkflows />} />
              <Route path="templates" element={<Templates />} />
              <Route path="chat" element={<Builder initialTab="chat" />} />
              <Route path="preview" element={<Preview />} />
              <Route path="builder" element={<Builder />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
