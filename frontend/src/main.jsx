// main.jsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "./index.css"
import App from "./App.jsx"
import CustomCursor from "./components/ui/CustomCursor"
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CustomCursor />
        <ToastNotification />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
)