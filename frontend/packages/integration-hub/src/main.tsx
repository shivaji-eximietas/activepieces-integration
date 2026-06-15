import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'

import { IntegrationHubPage } from './components/IntegrationHubPage'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <IntegrationHubPage />
    </QueryClientProvider>
  </React.StrictMode>,
)
