
import { GoogleGenAI } from '@google/genai';
import type { StockData } from '../types';
import { ApiError, InvalidTickerError, DataProcessingError } from './errors';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Caching Implementation ---
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const stockDataCache = new Map<string, { data: StockData; timestamp: number }>();

export const getStockData = async (ticker: string): Promise<StockData> => {
  const upperTicker = ticker.toUpperCase();

  // 1. Check cache first
  const cachedEntry = stockDataCache.get(upperTicker);
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION_MS)) {
    console.log(`Returning cached data for ${upperTicker}`);
    return cachedEntry.data;
  }

  // 2. If not in cache or stale, fetch from API
  console.log(`Fetching new data for ${upperTicker}`);
  
  const systemInstruction = `You are a meticulous financial analyst AI. Your sole task is to retrieve and structure a comprehensive set of financial data points for a given stock ticker based on a detailed JSON schema. You must adhere to a rigorous process: 1. Dissect the user's request to understand every required data field, including current and previous year values. 2. Use your search tool to find the most current and accurate values for each field, prioritizing official sources like SEC filings (10-K, 10-Q) and top-tier financial news outlets (Bloomberg, Reuters, Yahoo Finance). 3. Internally, think step-by-step to verify each piece of data before constructing the final output. 4. Your final output must be ONLY the raw, minified JSON object requested by the user. Do not include any introductory text, explanations, or markdown formatting.`;
  
  const userPrompt = `Analyze the stock ticker "${ticker}" and return a single, minified JSON object with the following structure. All fields are mandatory. If the ticker is invalid or you cannot confidently find all required data, return a JSON object containing an "error" field: {"ticker": "${ticker}", "error": "Invalid Ticker or insufficient data"}. JSON schema: {
  "ticker": "string",
  "companyName": "string",
  "logoUrl": "string",
  "currentPrice": "number",
  "marketCap": "number",
  "eps": "number (TTM)",
  "bookValuePerShare": "number",
  "currentAssets": "number",
  "currentLiabilities": "number",
  "roe": "number (Return on Equity, as decimal)",
  "debtToEquity": "number",
  "longTermDebt": "number",
  "hasPositiveEarningsLast10Years": "boolean",
  "hasUninterruptedDividendsLast20Years": "boolean",
  "eps10YearsAgo": "number",
  "threeYearAverageEPS": "number",
  "totalLiabilities": "number",
  "preferredStockValue": "number",
  "operatingCashFlow": "number",
  "netIncome": "number",
  "capitalExpenditures": "number",
  "estimatedEPSGrowthRate": "number (5-year forward estimate, as decimal)",
  "sharesOutstanding": {"currentYear": "number", "previousYear": "number"},
  "roa": {"currentYear": "number (as decimal)", "previousYear": "number (as decimal)"},
  "longTermDebtHistory": {"currentYear": "number", "previousYear": "number"},
  "currentRatioHistory": {"currentYear": "number", "previousYear": "number"},
  "grossMargin": {"currentYear": "number (as decimal)", "previousYear": "number (as decimal)"},
  "assetTurnover": {"currentYear": "number", "previousYear": "number"},
  "qualitativeAnalysis": {
    "economicMoat": "string (1-2 sentence analysis of competitive advantages)",
    "managementQuality": "string (1-2 sentence analysis of management effectiveness and integrity)"
  },
  "historicalPrices": [{"date": "YYYY-MM-DD", "price": "number"}],
  "historicalEPS": [{"year": "number", "eps": "number"}],
  "historicalDebtToEquity": [{"year": "number", "ratio": "number"}],
  "historicalPE": [{"year": "number", "ratio": "number"}]
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{ text: userPrompt }],
      config: {
        systemInstruction: systemInstruction,
        tools: [{googleSearch: {}}],
      },
    });

    let text = response.text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        text = jsonMatch[1];
    }

    const data = JSON.parse(text);

    if (data.error) {
      throw new InvalidTickerError(upperTicker);
    }
    
    // Deeper validation for nested objects
    const requiredFields = [
      'companyName', 'currentPrice', 'marketCap', 'eps', 'bookValuePerShare', 'currentAssets', 'currentLiabilities',
      'roe', 'debtToEquity', 'longTermDebt', 'hasPositiveEarningsLast10Years', 'hasUninterruptedDividendsLast20Years',
      'eps10YearsAgo', 'threeYearAverageEPS', 'totalLiabilities', 'preferredStockValue', 'operatingCashFlow',
      'netIncome', 'capitalExpenditures', 'estimatedEPSGrowthRate', 'sharesOutstanding', 'roa', 'longTermDebtHistory',
      'currentRatioHistory', 'grossMargin', 'assetTurnover', 'qualitativeAnalysis', 'historicalPrices', 'historicalEPS'
    ];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        throw new DataProcessingError(`Missing required field "${field}" in API response.`);
      }
    }
     if (typeof data.sharesOutstanding.currentYear !== 'number' || typeof data.roa.currentYear !== 'number' || typeof data.qualitativeAnalysis.economicMoat !== 'string') {
      throw new DataProcessingError('Invalid nested data types received from API.');
    }

    // Sort historical data to ensure correct chronological order for charts
    ['historicalPrices', 'historicalEPS', 'historicalDebtToEquity', 'historicalPE'].forEach(key => {
        if (data[key] && Array.isArray(data[key])) {
            if (key === 'historicalPrices') {
                data[key].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            } else {
                data[key].sort((a: any, b: any) => a.year - b.year);
            }
        }
    });
    
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const stockDataResult = { ...data, groundingChunks } as StockData;
    
    stockDataCache.set(upperTicker, { data: stockDataResult, timestamp: Date.now() });
    console.log(`Cached new data for ${upperTicker}`);
    
    return stockDataResult;

  } catch (error) {
    if (error instanceof InvalidTickerError || error instanceof DataProcessingError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      console.error('Failed to parse JSON response:', error);
      throw new DataProcessingError('Received malformed data from the financial service.');
    }
    console.error('Gemini API call or data processing failed:', error);
    throw new ApiError('Failed to fetch or process stock data from the generative model.');
  }
};
