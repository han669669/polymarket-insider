import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRecentTrades } from '../lib/api';

export interface WhaleAlert {
  id: string;
  trader: string;
  traderName: string | null;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  value: number;
  market: string;
  outcome: string;
  timestamp: number;
  transactionHash?: string;
}

interface WhaleActivityResult {
  alerts: WhaleAlert[];
  isLoading: boolean;
  isFetching: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  refetch: () => Promise<number>; // Returns count of new trades found
  loadMore: () => Promise<number>; // Returns count of new trades found
  oldestTimestamp: number | null;
  lastUpdated: number | null; // Timestamp of last successful fetch
}

interface UseWhaleActivityOptions {
  minValue?: number;
  onAutoRefresh?: (newCount: number) => void; // Called after auto-refresh with count of new whales
}

// Persistent store for whale alerts (survives re-renders and refreshes)
const whaleStore = {
  alerts: new Map<string, WhaleAlert>(),
  oldestOffset: 0,
};

function tradeToWhaleAlert(trade: Awaited<ReturnType<typeof fetchRecentTrades>>[0], minValue: number): WhaleAlert | null {
  const value = trade.size * trade.price;
  if (value < minValue) return null;
  
  const id = trade.transactionHash || `${trade.proxyWallet}-${trade.timestamp}-${trade.conditionId}-${trade.size}`;
  
  return {
    id,
    trader: trade.proxyWallet,
    traderName: trade.name || trade.pseudonym || null,
    side: trade.side,
    size: trade.size,
    price: trade.price,
    value,
    market: trade.title || 'Unknown Market',
    outcome: trade.outcome || 'Unknown',
    timestamp: trade.timestamp,
    transactionHash: trade.transactionHash,
  };
}

export function useWhaleActivity(options: UseWhaleActivityOptions = {}): WhaleActivityResult {
  const { minValue = 1000, onAutoRefresh } = options;
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const minValueRef = useRef(minValue);
  const onAutoRefreshRef = useRef(onAutoRefresh);
  minValueRef.current = minValue;
  onAutoRefreshRef.current = onAutoRefresh;

  // Main query - fetches recent trades and merges with store
  const query = useQuery({
    queryKey: ['whaleActivity', minValue],
    queryFn: async () => {
      // Fetch recent trades (offset 0 = most recent)
      const trades = await fetchRecentTrades(500, 0);
      
      // Add new whale trades to store
      let newCount = 0;
      for (const trade of trades) {
        const alert = tradeToWhaleAlert(trade, minValueRef.current);
        if (alert && !whaleStore.alerts.has(alert.id)) {
          whaleStore.alerts.set(alert.id, alert);
          newCount++;
        }
      }
      
      // Return sorted alerts from store
      const alerts = Array.from(whaleStore.alerts.values())
        .sort((a, b) => b.timestamp - a.timestamp);
      
      // Update last updated timestamp
      const now = Date.now();
      setLastUpdated(now);
      
      return { 
        alerts, 
        newCount,
        updatedAt: now,
      };
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // Check for new trades every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Call onAutoRefresh callback when auto-refresh completes (not manual refresh)
  useEffect(() => {
    if (query.data && !isManualRefresh && onAutoRefreshRef.current) {
      onAutoRefreshRef.current(query.data.newCount);
    }
  }, [query.data?.updatedAt, isManualRefresh]);

  // Manual refresh with feedback
  const refetch = useCallback(async (): Promise<number> => {
    setIsManualRefresh(true);
    try {
      const result = await query.refetch();
      return result.data?.newCount ?? 0;
    } finally {
      // Reset after a short delay to allow the effect to skip
      setTimeout(() => setIsManualRefresh(false), 100);
    }
  }, [query]);

  // Load more older trades
  const loadMore = useCallback(async (): Promise<number> => {
    if (isLoadingMore) return 0;
    
    setIsLoadingMore(true);
    let foundCount = 0;
    try {
      // Fetch older trades by increasing offset
      const newOffset = whaleStore.oldestOffset + 500;
      const trades = await fetchRecentTrades(500, newOffset);
      
      if (trades.length > 0) {
        // Add whale trades to store
        for (const trade of trades) {
          const alert = tradeToWhaleAlert(trade, minValueRef.current);
          if (alert && !whaleStore.alerts.has(alert.id)) {
            whaleStore.alerts.set(alert.id, alert);
            foundCount++;
          }
        }
        
        whaleStore.oldestOffset = newOffset;
        
        // Invalidate query to trigger re-render with new data
        await queryClient.invalidateQueries({ queryKey: ['whaleActivity'] });
      }
    } catch (error) {
      console.error('Failed to load more whale activity:', error);
    } finally {
      setIsLoadingMore(false);
    }
    return foundCount;
  }, [isLoadingMore, queryClient]);

  // Get oldest timestamp for display
  const alerts = query.data?.alerts ?? [];
  const oldestTimestamp = alerts.length > 0 ? alerts[alerts.length - 1].timestamp : null;

  return {
    alerts,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isLoadingMore,
    error: query.error ?? null,
    refetch,
    loadMore,
    oldestTimestamp,
    lastUpdated,
  };
}
