'use client';

import { useState, useEffect } from 'react';

interface AdminStats {
  totalVolume: number;
  activeBets: number;
  totalUsers: number;
  pendingSettlements: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface PendingBet {
  id: string;
  user_id: string;
  event_data: {
    home_team: string;
    away_team: string;
  };
  selection: string;
  stake: number;
  status: string;
  placed_at: string;
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bets' | 'users' | 'settlements' | 'system'>('dashboard');
  const [stats, setStats] = useState<AdminStats>({
    totalVolume: 0,
    activeBets: 0,
    totalUsers: 0,
    pendingSettlements: 0,
    systemHealth: 'healthy',
  });
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Mock admin data - in real app, fetch from your API with admin auth
      const mockStats: AdminStats = {
        totalVolume: 2547832.50,
        activeBets: 1247,
        totalUsers: 8934,
        pendingSettlements: 23,
        systemHealth: 'healthy',
      };

      const mockPendingBets: PendingBet[] = [
        {
          id: '1',
          user_id: 'user_123',
          event_data: {
            home_team: 'Los Angeles Lakers',
            away_team: 'Golden State Warriors',
          },
          selection: 'Los Angeles Lakers',
          stake: 500,
          status: 'pending',
          placed_at: new Date().toISOString(),
        },
        {
          id: '2',
          user_id: 'user_456',
          event_data: {
            home_team: 'Kansas City Chiefs',
            away_team: 'Buffalo Bills',
          },
          selection: 'Over 45.5',
          stake: 1000,
          status: 'pending',
          placed_at: new Date(Date.now() - 3600000).toISOString(),
        },
      ];

      const mockAlerts: SystemAlert[] = [
        {
          id: '1',
          type: 'warning',
          message: 'High API usage detected for The Odds API',
          timestamp: new Date().toISOString(),
          resolved: false,
        },
        {
          id: '2',
          type: 'info',
          message: 'Daily settlement batch completed successfully',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          resolved: true,
        },
      ];

      setStats(mockStats);
      setPendingBets(mockPendingBets);
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleBet = async (betId: string, result: 'won' | 'lost') => {
    try {
      // In real app, call your settlement API
      console.log(`Settling bet ${betId} as ${result}`);
      // Update local state
      setPendingBets(prev => prev.filter(bet => bet.id !== betId));
      setStats(prev => ({ ...prev, pendingSettlements: prev.pendingSettlements - 1 }));
    } catch (error) {
      console.error('Failed to settle bet:', error);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'border-red-500/50 bg-red-500/10';
      case 'warning': return 'border-yellow-500/50 bg-yellow-500/10';
      case 'info': return 'border-blue-500/50 bg-blue-500/10';
      default: return 'border-gray-500/50 bg-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-cyan-400 text-xl">Loading Admin Console...</p>
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
                Admin Console
              </h1>
              <p className="text-gray-300 mt-2">x402bets Platform Management</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">System Status</div>
                <div className={`font-bold ${getHealthColor(stats.systemHealth)}`}>
                  {stats.systemHealth.toUpperCase()}
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full ${
                stats.systemHealth === 'healthy' ? 'bg-green-400' :
                stats.systemHealth === 'warning' ? 'bg-yellow-400' : 'bg-red-400'
              } animate-pulse`}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-4">
            {[
              { key: 'dashboard', label: 'Dashboard' },
              { key: 'bets', label: 'Bet Management' },
              { key: 'users', label: 'User Management' },
              { key: 'settlements', label: 'Settlements' },
              { key: 'system', label: 'System Health' },
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

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <h3 className="text-cyan-400 font-bold mb-2">Total Volume</h3>
                <div className="text-3xl font-bold text-white">${stats.totalVolume.toLocaleString()}</div>
                <div className="text-green-400 text-sm">+8.2% from last week</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <h3 className="text-purple-400 font-bold mb-2">Active Bets</h3>
                <div className="text-3xl font-bold text-white">{stats.activeBets.toLocaleString()}</div>
                <div className="text-blue-400 text-sm">Across all markets</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <h3 className="text-yellow-400 font-bold mb-2">Total Users</h3>
                <div className="text-3xl font-bold text-white">{stats.totalUsers.toLocaleString()}</div>
                <div className="text-green-400 text-sm">+12 new today</div>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
                <h3 className="text-red-400 font-bold mb-2">Pending Settlements</h3>
                <div className="text-3xl font-bold text-white">{stats.pendingSettlements}</div>
                <div className="text-yellow-400 text-sm">Requires attention</div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Recent System Alerts</h3>
              <div className="space-y-4">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className={`border rounded-lg p-4 ${getAlertColor(alert.type)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.type === 'error' ? 'bg-red-400' :
                          alert.type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'
                        }`}></div>
                        <span className="text-white font-medium">{alert.message}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bet Management Tab */}
        {activeTab === 'bets' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Pending Bets Requiring Review</h3>
              <div className="space-y-4">
                {pendingBets.map((bet) => (
                  <div key={bet.id} className="border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-white font-bold text-lg">
                          {bet.event_data.away_team} @ {bet.event_data.home_team}
                        </div>
                        <div className="text-gray-400 text-sm">
                          User: {bet.user_id} • Placed: {new Date(bet.placed_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-cyan-400 font-bold text-xl">${bet.stake}</div>
                        <div className="text-sm text-gray-400">Stake</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">Selection: {bet.selection}</div>
                        <div className="text-yellow-400 text-sm">Status: {bet.status.toUpperCase()}</div>
                      </div>
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleSettleBet(bet.id, 'won')}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Mark Won
                        </button>
                        <button
                          onClick={() => handleSettleBet(bet.id, 'lost')}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Mark Lost
                        </button>
                        <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* System Health Tab */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">API Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg">
                  <span className="text-white">The Odds API</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-green-400 text-sm">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg">
                  <span className="text-white">Supabase Database</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-green-400 text-sm">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg">
                  <span className="text-white">Sei Network</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                    <span className="text-yellow-400 text-sm">Degraded</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-6">Performance Metrics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">API Response Time</span>
                    <span className="text-cyan-400">245ms</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-cyan-400 h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Database Load</span>
                    <span className="text-green-400">32%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-green-400 h-2 rounded-full" style={{ width: '32%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Memory Usage</span>
                    <span className="text-yellow-400">68%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '68%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}