'use client'

import { solanaWeb3JsAdapter, projectId, networks } from '@/config'
import { createAppKit } from '@reown/appkit/react'
import React, { type ReactNode } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/error-boundary'

// Set up metadata
const metadata = {
  name: 'Member Pass NFT',
  description: 'Member Pass Solana NFT Platform',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://example.com',
  icons: ['https://example.com/icon.png']
}

// Create the modal
export const modal = createAppKit({
  adapters: [solanaWeb3JsAdapter],
  projectId,
  networks,
  metadata,
  themeMode: 'dark',
  features: {
    analytics: true,
    email: false,
    socials: false,
  },
  themeVariables: {
    '--w3m-accent': '#FFD700',
    '--w3m-border-radius-master': '12px',
  }
})

function ContextProvider({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
      <Toaster />
    </ErrorBoundary>
  )
}

export default ContextProvider