'use client'

import { useEffect, useState } from 'react'
import { getProfileStats } from '@/lib/evm/stats'
import { ethers } from 'ethers'

export default function ProfilePage({ params }: { params: { address: string } }) {
  const { address } = params
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{
    address: string
    wins: number
    losses: number
    pending: number
    totalStakedWei: bigint
    marketsTouched: number
  } | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getProfileStats(address)
        setStats(res)
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile stats')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [address])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black tracking-tight">Profile</h1>
        <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-bold font-mono">{address}</span>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading profile…</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="text-sm text-muted-foreground">Wins</div>
            <div className="text-3xl font-black">{stats.wins}</div>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="text-sm text-muted-foreground">Losses</div>
            <div className="text-3xl font-black">{stats.losses}</div>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-3xl font-black">{stats.pending}</div>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <div className="text-sm text-muted-foreground">Total Staked</div>
            <div className="text-3xl font-black">{ethers.formatUnits(stats.totalStakedWei, 18)} </div>
          </div>
          <div className="bg-card border border-border/50 rounded-2xl p-4 md:col-span-2">
            <div className="text-sm text-muted-foreground">Markets Participated</div>
            <div className="text-3xl font-black">{stats.marketsTouched}</div>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground">No stats available.</div>
      )}
    </div>
  )
}