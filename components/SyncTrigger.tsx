'use client'

import { useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'

export function SyncTrigger() {
  const { userId, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded || !userId) return
    fetch('/api/teller/sync', { method: 'POST' }).catch(() => {})
  }, [isLoaded, userId])

  return null
}
