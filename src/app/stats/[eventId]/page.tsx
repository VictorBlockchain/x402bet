'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getEventBettors } from '@/lib/evm/stats'
import { ethers } from 'ethers'

export default function EventStatsPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [market, setMarket] = useState<string>('')
  const [settled, setSettled] = useState(false)
  const [winningSel, setWinningSel] = useState<string | undefined>(undefined)
  const [bettors, setBettors] = useState<ReturnType<typeof Array.prototype.slice> & any>([])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getEventBettors(eventId)
        setMarket(res.market)
        setSettled(res.settled)
        setWinningSel(res.winningSelection)
        setBettors(res.bettors)
      } catch (e: any) {
        setError(e?.message || 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [eventId])

  const title = `Game Stats`
  const winningLabel = (() => {
    if (!winningSel) return undefined
    const homeHash = ethers.keccak256(ethers.toUtf8Bytes('home'))
    const awayHash = ethers.keccak256(ethers.toUtf8Bytes('away'))
    if (winningSel.toLowerCase() === homeHash.toLowerCase()) return 'home'
    if (winningSel.toLowerCase() === awayHash.toLowerCase()) return 'away'
    return 'unknown'
  })()

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {market && market !== '0x0000000000000000000000000000000000000000' ? (
            <span className="bg-gradient-to-r from-chart-2 to-chart-3 text-white px-3 py-1 rounded-full text-xs font-bold">Market: {market.slice(0,6)}…{market.slice(-4)}</span>
          ) : (
            <span className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-xs font-bold">No market found</span>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${settled ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>
            {settled ? `Settled${winningLabel ? ` • Winner: ${winningLabel}` : ''}` : 'Open'}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading bettors…</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <table className="min-w-full">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Bettor</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Selection</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Stake</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Tx</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Profile</th>
              </tr>
            </thead>
            <tbody>
              {bettors.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>No bets yet.</td>
                </tr>
              ) : (
                bettors.map((b: any, i: number) => (
                  <tr key={`${b.txHash}-${i}`} className="border-t border-border/40">
                    <td className="px-4 py-3 font-mono text-sm">{b.bettor}</td>
                    <td className="px-4 py-3 text-sm">{b.selectionLabel ?? 'unknown'}</td>
                    <td className="px-4 py-3 text-sm">{ethers.formatUnits((b.stakeWei ?? ethers.toBigInt(0)), 18)}</td>
                    <td className="px-4 py-3 text-sm">
                      <a className="text-primary hover:underline" href={`https://sei.dev/explorer/tx/${b.txHash}`} target="_blank" rel="noreferrer">{b.txHash.slice(0,10)}…</a>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link className="text-accent hover:underline" href={`/profile/${b.bettor}`}>View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}