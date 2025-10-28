'use client';

import { useState, useEffect } from 'react';
import { getActiveNetworkLabel } from '@/lib/config/networks';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

interface Bet {
  id: string;
  sport_key: string;
  event_data: {
    home_team: string;
    away_team: string;
    commence_time: string;
  };
  selection: string;
  odds: number;
  stake: number;
  potential_payout: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  placed_at: string;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'bet_stake' | 'bet_payout' | 'fee';
  amount: number;
  balance_after: number;
  created_at: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export default function AccountPage() {
  const { user, primaryWallet } = useDynamicContext();
  const [activeTab, setActiveTab] = useState<'overview' | 'bets' | 'transactions' | 'settings'>('overview');
  const [bets, setBets] = useState<Bet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAccountData();
    }
  }, [user]);

  const fetchAccountData = async () => {
    try {
      // Mock data - in real app, fetch from your API
      const mockBets: Bet[] = [
        {
          id: '1',
          sport_key: 'basketball_nba',
          event_data: {
            home_team: 'Los Angeles Lakers',
            away_team: 'Golden State Warriors',
            commence_time: new Date().toISOString(),
          },
          selection: 'Los Angeles Lakers',
          odds: -110,
          stake: 100,
          potential_payout: 190.91,
          status: 'pending',
          placed_at: new Date().toISOString(),
        },
        {
          id: '2',
          sport_key: 'americanfootball_nfl',
          event_data: {
            home_team: 'Kansas City Chiefs',
            away_team: 'Buffalo Bills',
            commence_time: new Date(Date.now() - 86400000).toISOString(),
          },
          selection: 'Kansas City Chiefs',
          odds: 150,
          stake: 50,
          potential_payout: 125,
          status: 'won',
          placed_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];

      const mockTransactions: Transaction[] = [
        {
          id: '1',
          type: 'deposit',
          amount: 500,
          balance_after: 1500,
          created_at: new Date().toISOString(),
          status: 'confirmed',
        },
        {
          id: '2',
          type: 'bet_stake',
          amount: -100,
          balance_after: 1400,
          created_at: new Date().toISOString(),
          status: 'confirmed',
        },
      ];

      setBets(mockBets);
      setTransactions(mockTransactions);
      setBalance(1400);
    } catch (error) {
      console.error('Failed to fetch account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return 'text-green-400';
      case 'lost': return 'text-red-400';
      case 'pending': return 'text-yellow-400';
      case 'cancelled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'bet_payout':
        return 'text-green-400';
      case 'withdrawal':
      case 'bet_stake':
      case 'fee':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-cyan-400 text-xl">Please connect your wallet to view account</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400 text-xl">Loading Account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 pt-16">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Account Dashboard
              </h1>
              <p className="text-gray-300 mt-2">
                {primaryWallet?.address ? 
                  `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}` : 
                  'Wallet not connected'
                }
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400 mb-1">Balance</div>
              <div className="text-3xl font-bold text-cyan-400">${balance.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-4">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'bets', label: 'My Bets' },
              { key: 'transactions', label: 'Transactions' },
              { key: 'settings', label: 'Settings' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg'
                    : 'bg-black/40 text-gray-300 hover:bg-white/10 hover:text-white border border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-cyan-400 font-bold mb-2">Total Wagered</h3>
              <div className="text-3xl font-bold text-white">$1,250</div>
              <div className="text-green-400 text-sm">This month</div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-purple-400 font-bold mb-2">Total Won</h3>
              <div className="text-3xl font-bold text-white">$875</div>
              <div className="text-green-400 text-sm">+12.5% ROI</div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-yellow-400 font-bold mb-2">Active Bets</h3>
              <div className="text-3xl font-bold text-white">{bets.filter(b => b.status === 'pending').length}</div>
              <div className="text-blue-400 text-sm">Pending settlement</div>
            </div>
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-green-400 font-bold mb-2">Win Rate</h3>
              <div className="text-3xl font-bold text-white">67%</div>
              <div className="text-gray-400 text-sm">Last 30 days</div>
            </div>
          </div>
        )}

        {activeTab === 'bets' && (
          <div className="space-y-4">
            {bets.map((bet) => (
              <div key={bet.id} className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(bet.status)} bg-current/20`}>
                      {bet.status.toUpperCase()}
                    </span>
                    <span className="text-gray-400 text-sm">
                      {new Date(bet.placed_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-cyan-400 font-bold">${bet.stake}</div>
                    <div className="text-sm text-gray-400">Stake</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-white font-bold text-lg">
                      {bet.event_data.away_team} @ {bet.event_data.home_team}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {bet.sport_key.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-white font-medium">{bet.selection}</div>
                    <div className="text-cyan-400 font-bold">{formatOdds(bet.odds)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">${bet.potential_payout.toFixed(2)}</div>
                    <div className="text-sm text-gray-400">Potential Payout</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      tx.status === 'confirmed' ? 'bg-green-400' :
                      tx.status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'
                    }`}></div>
                    <div>
                      <div className="text-white font-medium capitalize">
                        {tx.type.replace('_', ' ')}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-lg ${getTransactionColor(tx.type)}`}>
                      {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Balance: ${tx.balance_after.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Wallet Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Connected Wallet</label>
                  <div className="bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white font-mono">
                    {primaryWallet?.address || 'Not connected'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Network</label>
                  <div className="bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-cyan-400">
                    {getActiveNetworkLabel()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Betting Preferences</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Default Stake</label>
                  <input
                    type="number"
                    placeholder="100"
                    className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Odds Format</label>
                  <select className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-cyan-400 focus:outline-none">
                    <option value="american">American (-110)</option>
                    <option value="decimal">Decimal (1.91)</option>
                  </select>
                </div>
                <div className="flex items-center space-x-3">
                  <input type="checkbox" className="w-4 h-4 text-cyan-400" />
                  <label className="text-gray-300">Enable push notifications</label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}