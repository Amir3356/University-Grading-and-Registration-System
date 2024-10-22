import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthProvider'
import { ThemeProvider } from '@/context/ThemeProvider'
import { useTheme } from '@/context/theme-context'
import { AppRouter } from '@/routes/AppRouter'
import { APP_CONFIG } from '@/config/app.config'

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      duration={APP_CONFIG.toastDuration}
    />
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </BrowserRouter>
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
