import axios from 'axios';
import { z } from 'zod';

// API endpoints via Vite proxy
const DATA_API_BASE = '/api/polymarket';
const GAMMA_API_BASE = '/api/gamma';

// Schemas for API responses
export const TradeSchema = z.object({
  proxyWallet: z.string(),
  side: z.enum(['BUY', 'SELL']),
  asset: z.string().optional(),
  conditionId: z.string(),
  size: z.number(),
  price: z.number(),
  timestamp: z.number(),
  title: z.string().optional(),
  slug: z.string().optional(),
  outcome: z.string().optional(),
  outcomeIndex: z.number().optional(),
  pseudonym: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  profileImage: z.string().optional().nullable(),
  transactionHash: z.string().optional(),
});

// Schema for closed positions (different from open positions)
export const ClosedPositionSchema = z.object({
  proxyWallet: z.string(),
  asset: z.string().optional(),
  conditionId: z.string(),
  avgPrice: z.number().optional(),
  totalBought: z.number().optional(),
  realizedPnl: z.number().optional(),
  curPrice: z.number().optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
  icon: z.string().optional(),
  eventSlug: z.string().optional(),
  outcome: z.string().optional(),
  outcomeIndex: z.number().optional(),
  oppositeOutcome: z.string().optional(),
  oppositeAsset: z.string().optional(),
  endDate: z.string().optional(),
  timestamp: z.number().optional(),
}).passthrough();

export type Trade = z.infer<typeof TradeSchema>;
export type ClosedPosition = z.infer<typeof ClosedPositionSchema>;

// User stats interface - matches what Polymarket shows
export interface UserStats {
  address: string;
  username: string | null;
  pseudonym: string | null;
  totalPositions: number;
  uniqueMarkets: number;
  winningTrades: number;
  totalTrades: number;
  winRate: number;
  realizedPnl: number;  // From subgraph - accurate
  volume: number;
  biggestWin: number;
}

// Fetch closed positions for a user
export async function fetchUserClosedPositions(userAddress: string, limit = 500): Promise<ClosedPosition[]> {
  try {
    const response = await axios.get(`${DATA_API_BASE}/closed-positions`, {
      params: {
        user: userAddress,
        limit,
      },
    });
    
    return z.array(ClosedPositionSchema).parse(response.data);
  } catch (error) {
    console.warn(`Failed to fetch closed positions for ${userAddress}:`, error);
    return [];
  }
}

// Calculate user stats from closed positions
export function calculateStatsFromClosedPositions(
  address: string,
  closedPositions: ClosedPosition[],
  profileInfo: { name: string | null; pseudonym: string | null }
): UserStats {
  const uniqueMarkets = new Set(closedPositions.map(p => p.conditionId));
  
  let winningTrades = 0;
  let totalRealizedPnl = 0;
  let totalVolume = 0;
  let biggestWin = 0;
  
  for (const pos of closedPositions) {
    const pnl = pos.realizedPnl || 0;
    totalRealizedPnl += pnl;
    totalVolume += pos.totalBought || 0;
    
    if (pnl > 0) {
      winningTrades++;
      if (pnl > biggestWin) {
        biggestWin = pnl;
      }
    }
  }
  
  const totalTrades = closedPositions.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  return {
    address,
    username: profileInfo.name,
    pseudonym: profileInfo.pseudonym,
    totalPositions: totalTrades,
    uniqueMarkets: uniqueMarkets.size,
    winningTrades,
    totalTrades,
    winRate,
    realizedPnl: totalRealizedPnl,
    volume: totalVolume,
    biggestWin,
  };
}

// Search for profile by address using gamma API
export async function searchProfile(address: string): Promise<{ name: string | null; pseudonym: string | null }> {
  try {
    const response = await axios.get(`${GAMMA_API_BASE}/public-search`, {
      params: { query: address, type: 'profiles' },
    });
    
    const profiles = response.data?.profiles || [];
    if (profiles.length > 0) {
      const profile = profiles[0];
      return {
        name: profile.displayUsernamePublic ? profile.name : null,
        pseudonym: profile.pseudonym || null,
      };
    }
    return { name: null, pseudonym: null };
  } catch {
    return { name: null, pseudonym: null };
  }
}

// Fetch recent trades from the platform
export async function fetchRecentTrades(limit = 1000, offset = 0): Promise<Trade[]> {
  const response = await axios.get(`${DATA_API_BASE}/trades`, {
    params: {
      limit,
      offset,
      takerOnly: true,
    },
  });
  
  const trades = z.array(TradeSchema.passthrough()).parse(response.data);
  return trades;
}

// Discover unique traders from recent trades
export function extractUniqueTraders(trades: Trade[]): Map<string, Trade[]> {
  const traderMap = new Map<string, Trade[]>();
  
  for (const trade of trades) {
    const existing = traderMap.get(trade.proxyWallet) ?? [];
    existing.push(trade);
    traderMap.set(trade.proxyWallet, existing);
  }
  
  return traderMap;
}

// Filter criteria for insider detection
export interface InsiderCriteria {
  minWinRate: number;      // e.g., 70 for 70%
  minProfit: number;       // e.g., 10000 for $10k
  minTrades: number;       // minimum trades
  minUniqueMarkets?: number;
}

export const DEFAULT_CRITERIA: InsiderCriteria = {
  minWinRate: 60,
  minProfit: 10000,
  minTrades: 10,
  minUniqueMarkets: 2,
};

// Check if user meets insider criteria
export function meetsInsiderCriteria(stats: UserStats, criteria: InsiderCriteria): boolean {
  return (
    stats.winRate >= criteria.minWinRate &&
    stats.realizedPnl >= criteria.minProfit &&
    stats.totalTrades >= criteria.minTrades &&
    (criteria.minUniqueMarkets === undefined || stats.uniqueMarkets >= criteria.minUniqueMarkets)
  );
}
