import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { RefreshCw, ArrowUpRight, ArrowDownRight, Clock, Zap, Sun, Moon, Check, AlertCircle } from 'lucide-react'
import { useWhaleActivity, type WhaleAlert } from './hooks/useWhaleActivity'
import { Analytics } from '@vercel/analytics/react'

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info' | 'warning'; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    // Start exit animation after 2.5s, then close after animation completes
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, 2500)
    
    const closeTimer = setTimeout(() => {
      onCloseRef.current()
    }, 2700) // 2500ms + 200ms for exit animation
    
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(closeTimer)
    }
  }, []) // Run once on mount

  const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
  const Icon = type === 'success' ? Check : type === 'warning' ? AlertCircle : Zap

  return (
    <div className={`fixed top-20 left-1/2 z-50 ${bgColor} text-white px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <Icon className="w-4 h-4" />
      {message}
    </div>
  )
}

// Utilities
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  return `$${value.toFixed(0)}`
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() / 1000) - timestamp)
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

// Format millisecond timestamp to "Xs ago" or "just now"
function formatTimeAgoShort(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 5) return 'now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

// Theme hook
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return { theme, setTheme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }
}

// Components - memoized to prevent unnecessary re-renders
const WhaleAlertRow = memo(function WhaleAlertRow({ alert, isDark }: { alert: WhaleAlert; isDark: boolean }) {
  const isBuy = alert.side === 'BUY'
  const displayName = alert.traderName || formatAddress(alert.trader)
  
  return (
    <a
      href={`https://polymarket.com/profile/${alert.trader}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors border-b ${
        isDark 
          ? 'hover:bg-gray-800/50 border-gray-800/50' 
          : 'hover:bg-gray-50 border-gray-100'
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
        isBuy 
          ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' 
          : isDark ? 'bg-red-500/10' : 'bg-red-50'
      }`}>
        {isBuy ? (
          <ArrowUpRight className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
        ) : (
          <ArrowDownRight className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {displayName}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            isBuy 
              ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
              : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
          }`}>
            {alert.side}
          </span>
        </div>
        <p className={`text-sm truncate mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {alert.market}
        </p>
      </div>
      
      <div className="text-right shrink-0">
        <div className={`font-semibold tabular-nums ${
          isBuy 
            ? isDark ? 'text-emerald-400' : 'text-emerald-600'
            : isDark ? 'text-red-400' : 'text-red-600'
        }`}>
          {formatCurrency(alert.value)}
        </div>
        <div className={`text-xs flex items-center justify-end gap-1 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Clock className="w-3 h-3" />
          {timeAgo(alert.timestamp)}
        </div>
      </div>
    </a>
  )
})

function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const [toast, setToast] = useState<{ id: number; message: string; type: 'success' | 'info' | 'warning' } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [, forceUpdate] = useState(0) // For live-updating the "Last Updated" display
  const toastIdRef = useRef(0) // For unique toast keys
  
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning') => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, message, type })
  }, [])
  
  // Handle auto-refresh notifications
  const handleAutoRefresh = useCallback((newCount: number) => {
    // Only show notification if we found new whales (skip initial load)
    if (newCount > 0) {
      showToast(`${newCount} new whale${newCount > 1 ? 's' : ''} detected!`, 'success')
    }
  }, [showToast])

  // $1K threshold for whale alerts
  const { 
    alerts, 
    isLoading: whalesLoading, 
    isFetching: whalesFetching, 
    isLoadingMore: whalesLoadingMore,
    refetch: refetchWhales,
    loadMore: loadMoreWhales,
    oldestTimestamp,
    lastUpdated,
  } = useWhaleActivity({ minValue: 1000, onAutoRefresh: handleAutoRefresh })

  // Update the "Last Updated" display every 1 seconds (personally disliked 5 seconds chosen by opus 4.5)
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const newCount = await refetchWhales()
      if (newCount > 0) {
        showToast(`Found ${newCount} new whale trade${newCount > 1 ? 's' : ''}!`, 'success')
      } else {
        showToast('No new trades yet', 'info')
      }
    } catch {
      showToast('Failed to refresh', 'warning')
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchWhales, showToast])

  const handleLoadMore = useCallback(async () => {
    const foundCount = await loadMoreWhales()
    if (foundCount > 0) {
      showToast(`Found ${foundCount} more whale trade${foundCount > 1 ? 's' : ''}`, 'success')
    } else {
      showToast('No more trades in API range', 'info')
    }
  }, [loadMoreWhales, showToast])

  const bgColor = isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50'
  const cardBg = isDark ? 'bg-[#111111]' : 'bg-white'
  const borderColor = isDark ? 'border-gray-800/50' : 'border-gray-200'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-600'
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400'

  return (
    <div className={`min-h-screen ${bgColor} ${textPrimary} font-sans antialiased`}>
      {/* Toast Notification */}
      {toast && (
        <Toast 
          key={toast.id}
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Header */}
      <header className={`border-b ${borderColor} ${cardBg} sticky top-0 z-10 backdrop-blur-xl bg-opacity-80`}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              {/* Polymarket-style logo */}
              <div className="relative">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-[#00D395]' : 'bg-[#00D395]'}`}>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                    <path d="M13 3L4 14h7v7l9-11h-7V3z" />
                  </svg>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className={`font-semibold tracking-tight ${textPrimary}`}>polymarket</span>
                  <span className={`font-semibold tracking-tight ${isDark ? 'text-[#00D395]' : 'text-[#00B386]'}`}>insider</span>
                </div>
                <span className={`text-[10px] uppercase tracking-widest ${textMuted}`}>Whale Scanner</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-xl transition-colors ${
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                }`}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || whalesFetching}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isDark 
                    ? 'bg-white text-black hover:bg-gray-100' 
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50`}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Checking...' : 'Check Now'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className={`${cardBg} rounded-2xl p-4 border ${borderColor}`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Whales Found</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 tabular-nums text-emerald-500`}>{alerts.length}</p>
            <p className={`text-xs ${textMuted} mt-1`}>Trades over $1K</p>
          </div>
          <div className={`${cardBg} rounded-2xl p-4 border ${borderColor}`}>
            <p className={`text-xs font-medium uppercase tracking-wider ${textMuted}`}>Last Updated</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 tabular-nums ${textPrimary}`}>
              {lastUpdated ? formatTimeAgoShort(lastUpdated) : '—'}
            </p>
            <p className={`text-xs ${textMuted} mt-1`}>Auto-refreshes every 30s</p>
          </div>
        </div>

        {/* Whale Activity Panel */}
        <div className={`${cardBg} rounded-2xl border ${borderColor} overflow-hidden`}>
          <div className={`px-4 py-3.5 border-b ${borderColor} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <h2 className={`font-semibold ${textPrimary}`}>Live Whale Activity</h2>
            </div>
            <span className={`text-xs ${textMuted}`}>Auto-refreshes every 30s</span>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {whalesLoading && alerts.length === 0 ? (
              <div className="py-16 text-center">
                <RefreshCw className={`w-5 h-5 animate-spin mx-auto mb-3 ${textMuted}`} />
                <p className={textMuted}>Scanning for whale activity...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-16 text-center">
                <Zap className={`w-8 h-8 mx-auto mb-3 ${textMuted}`} />
                <p className={textSecondary}>No large positions found</p>
                <p className={`text-sm ${textMuted} mt-1`}>Positions over $1K will appear here</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <WhaleAlertRow key={alert.id} alert={alert} isDark={isDark} />
              ))
            )}
          </div>
          
          {/* Load More Button */}
          <div className={`p-3 border-t ${borderColor}`}>
            <div className={`text-xs ${textMuted} text-center mb-2`}>
              {oldestTimestamp && (
                <>Oldest: {timeAgo(oldestTimestamp)} ago</>
              )}
              {' • '}
              <span className="text-amber-500/80">~3 min API limit</span>
            </div>
            <button
              onClick={handleLoadMore}
              disabled={whalesLoadingMore}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                isDark 
                  ? 'bg-gray-800 hover:bg-gray-700 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
              } disabled:opacity-50`}
            >
              {whalesLoadingMore ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              {whalesLoadingMore ? 'Scanning...' : 'Scan More Trades'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className={`mt-8 pt-5 border-t ${borderColor} text-center space-y-2`}>
          <div className="flex items-center justify-center gap-1.5">
            <span className={`text-xs ${textMuted}`}>polymarket</span>
            <span className={`text-xs ${isDark ? 'text-[#00D395]' : 'text-[#00B386]'}`}>insider</span>
          </div>
          <p className={`text-[11px] ${textMuted}`}>
            Live data • Auto-updates every 30s • ~3 min API window
          </p>
          <div className="flex items-center justify-center space-x-1">
            <p className={`text-[11px] ${textMuted}`}>
              made by{' '}
              <a
                href="https://www.craftedbyhan.xyz"
                target="_blank"
                rel="noreferrer"
                className="hidden md:inline-block text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
              >
                han
              </a>
            </p>
            <a
              href="https://www.craftedbyhan.xyz"
              target="_blank"
              rel="noreferrer"
              className="inline-block md:hidden text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              han
            </a>
          </div>
        </footer>
      </main>
    <Analytics />
    </div>
  )
}

export default App
