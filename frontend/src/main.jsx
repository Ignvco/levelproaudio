// main.jsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "./index.css"
import "./styles/admin-ui.css"
import App from "./App.jsx"
import ErrorBoundary from "./components/ErrorBoundary.jsx"
import ToastNotification from "./components/ui/ToastNotification"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           1000 * 60 * 5,
      retry:               1,
      refetchOnWindowFocus:false,
    },
  },
})

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ToastNotification />
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
)