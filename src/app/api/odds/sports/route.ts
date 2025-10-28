import { NextRequest, NextResponse } from 'next/server';

const API_HOST = 'https://api.the-odds-api.com';
const API_KEY = process.env.ODDS_API_KEY;

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCachedData(key: string, data: any, ttlMs: number) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

// Rate limiting (simple in-memory implementation)
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    if (!API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const cacheKey = 'sports-list';
    
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return NextResponse.json({
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch from The Odds API
    const response = await fetch(`${API_HOST}/v4/sports/?apiKey=${API_KEY}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'API rate limit exceeded, please try again later' },
          { status: 429 }
        );
      }
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Cache for 5 minutes (sports list doesn't change often)
    setCachedData(cacheKey, data, 5 * 60 * 1000);

    return NextResponse.json({
      data,
      cached: false,
      timestamp: new Date().toISOString(),
      remainingRequests: response.headers.get('x-requests-remaining'),
      usedRequests: response.headers.get('x-requests-used'),
    });

  } catch (error) {
    console.error('Sports API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sports data' },
      { status: 500 }
    );
  }
}