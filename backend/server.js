const express = require('express');
const cors = require('cors');
const pool = require('./db');  // Assuming you are using PostgreSQL
const axios = require('axios');
const yahooFinance = require('yahoo-finance2').default;  // Yahoo Finance API
const child_process = require("child_process");
const { spawn } = require("child_process");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const technicalIndicators = require('technicalindicators');
const { RSI } = require('technicalindicators');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Enable CORS for frontend communication
const corsOptions = {
  // origin: 'http://localhost:3000',  // React app running on port 3000
  methods: 'GET',
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(express.json());

// Welcome route
app.get('/', (req, res) => {
  res.send('Welcome to the Stock Search API! Use /search?query=stockname to search.');
});

// Search API - Filters stocks as you type
app.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    const results = await pool.query(
      `SELECT name_of_company, symbol FROM companies WHERE name_of_company ILIKE $1 LIMIT 5`,
      [`%${query}%`]
    );
    res.json(results.rows);
  } catch (err) {
    console.error('Error fetching stocks:', err.message);
    res.status(500).send('Server Error');
  }
});

app.get('/stock-price', async (req, res) => {
  try {
    let { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }

    // Append ".NS" if not present
    if (!symbol.endsWith('.NS')) {
      symbol = `${symbol}.NS`;
    }

    console.log(`📈 Fetching stock price for: ${symbol}`);

    // Fetch summary from Yahoo Finance
    const stockData = await yahooFinance.quoteSummary(symbol, { modules: ['price'] });

    // Defensive check for expected data structure
    if (!stockData || !stockData.price || !stockData.price.regularMarketPrice) {
      return res.status(404).json({ error: 'Stock data not found or incomplete' });
    }

    // Respond with formatted data
    res.json({
      symbol: stockData.price.symbol,
      price: stockData.price.regularMarketPrice,
      currency: stockData.price.currency,
    });

  } catch (error) {
    console.error('❌ Error fetching stock price:', error.message);
    res.status(500).json({ error: 'Error fetching stock price. Please try again later.' });
  }
});

app.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    console.log(`🔍 Incoming Search Query: '${query}'`);

    const results = await pool.query(
      `SELECT name_of_company, symbol 
       FROM companies 
       WHERE name_of_company ILIKE $1 OR symbol ILIKE $1 
       LIMIT 5`,
      [`%${query}%`]
    );

    console.log('📦 Raw Search Results:');
    results.rows.forEach(row =>
      console.log(`'${row.name_of_company}' - '${row.symbol}'`)
    );

    // Only return name_of_company to frontend
    const namesOnly = results.rows.map(row => ({
      name_of_company: row.name_of_company
    }));

    res.json(namesOnly);
  } catch (err) {
    console.error('❌ Error fetching stocks:', err.message);
    res.status(500).send('Server Error');
  }
});



// Historical stock price API using Yahoo Finance
app.get('/stock-price-history', async (req, res) => {
    try {
      let { symbol, interval } = req.query;
  
      // Default to 1d if no interval is specified
      if (!interval) {
        interval = '1d';
      }
  
      // Check if symbol already has ".NS", if not, append it
      if (!symbol.includes('.')) {
        symbol = `${symbol}.NS`;  // Append .NS for Indian stocks
      }
  
      // Define valid intervals and corresponding time calculations
      const validIntervals = {
        '1d': 1,
        '1wk': 7,
        '1mo': 30,
        '1y': 365,
        '5y': 5 * 365,
        'max': 365 * 20, // Assume max means last 20 years
      };
  
      if (!validIntervals[interval]) {
        return res.status(400).send('Invalid interval. Valid options: 1d, 1wk, 1mo, 1y, 5y, max.');
      }
  
      const period2 = new Date(); // Current date
      const period1 = new Date();
      period1.setDate(period1.getDate() - validIntervals[interval]); // Subtract days based on interval
  
      // Fetch historical stock data using Yahoo Finance API
      const historicalData = await yahooFinance.historical(symbol, {
        period1: Math.floor(period1.getTime() / 1000), // Convert to UNIX timestamp
        period2: Math.floor(period2.getTime() / 1000), // Convert to UNIX timestamp
        interval: '1d', // Daily interval
      });
  
      // Return data including volume
      res.json(
        historicalData.map(item => ({
          timestamp: item.date,
          price: item.close, // Closing price
          volume: item.volume, // Volume data
        }))
      );
    } catch (error) {
      console.error('Error fetching stock price history:', error);
      res.status(500).send('Error fetching stock price history');
    }
  });  

  app.get("/get-stock-symbol", async (req, res) => {
    try {
      const { stockName } = req.query;
  
      if (!stockName) {
        return res.status(400).json({ error: "Stock name is required" });
      }
  
      // Correct SQL query using parameterized query
      const result = await pool.query(
        "SELECT symbol FROM companies WHERE name_of_company = $1", 
        [stockName]
      );
  
      if (result.rows.length > 0) {
        res.json({ symbol: result.rows[0].symbol });
      } else {
        res.status(404).json({ error: "Stock not found" });
      }
    } catch (error) {
      console.error("Error fetching stock symbol:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });  

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});



///////////////////////FINAL////////////////////////////////

// Route to get income statement data
app.get("/yfinance/:symbol", async (req, res) => {
  const { symbol } = req.params;

  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['incomeStatementHistory']
    });

    const incomeStatements = result?.incomeStatementHistory?.incomeStatementHistory;

    if (!incomeStatements || !Array.isArray(incomeStatements)) {
      return res.status(404).json({ error: "Income statement data not available" });
    }

    const sales = incomeStatements.map(item => item.totalRevenue || 0);
    const profit = incomeStatements.map(item => item.netIncome || 0);
    const years = incomeStatements.map(item => new Date(item.endDate).getFullYear());

    return res.json({ symbol, sales, profit, years });
  } catch (error) {
    console.error("❌ Error fetching data from Yahoo Finance:", error.message);
    return res.status(500).json({ error: "Failed to fetch data from Yahoo Finance" });
  }
});

////////////////////////HISTORIC EPS////////////////////////////////////////

app.get("/historic-eps", async (req, res) => {
  const { symbol } = req.query;

  if (!symbol) return res.status(400).json({ error: "Missing stock symbol" });

  try {
    // Fetch earnings history from the correct module
    const analysisData = await yahooFinance.quoteSummary(symbol, {
      modules: ["earningsHistory"],
    });

    // Extract the earnings history data
    const earningsHistory = analysisData?.earningsHistory?.history || [];

    // Map the data to include EPS Actual and its respective quarter
    const epsHistory = earningsHistory.map((entry) => ({
      quarter: entry.quarter, // Use the quarter field
      epsActual: entry.epsActual, // Extract EPS Actual
    }));

    res.json({ symbol, epsHistory });
  } catch (error) {
    console.error("Error fetching EPS data:", error);
    res.status(500).json({ error: "Failed to fetch EPS data" });
  }
});

///////////////////////////////////////Historical PE Ratio////////////////////////////////////////////////////////////

app.get("/historical-pe-scrape", async (req, res) => {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Missing stock symbol" });
  }

  const url = `https://finance.yahoo.com/quote/${symbol}.NS/key-statistics`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Optional: Block images/styles/fonts for faster load
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    await page.waitForSelector("section[data-testid='qsp-statistics']", {
      timeout: 15000,
    });

    const result = await page.evaluate(() => {
      const data = {
        peSeries: [],
        dates: [],
      };

      const tables = document.querySelectorAll(
        "section[data-testid='qsp-statistics'] table"
      );

      tables.forEach((table) => {
        const rows = table.querySelectorAll("tr");
        rows.forEach((row) => {
          const cells = row.querySelectorAll("td");
          if (cells.length > 1 && cells[0].innerText.includes("Trailing P/E")) {
            cells.forEach((cell, idx) => {
              if (idx !== 0) {
                const val = cell.innerText.trim();
                if (val !== "--" && !isNaN(parseFloat(val))) {
                  data.peSeries.push(parseFloat(val));
                }
              }
            });
          }
        });
      });

      const headerRow = document.querySelector(
        "section[data-testid='qsp-statistics'] table thead tr"
      );
      if (headerRow) {
        headerRow.querySelectorAll("th").forEach((th, idx) => {
          if (idx !== 0) {
            const date = th.innerText.trim();
            if (date) data.dates.push(date);
          }
        });
      }

      return data;
    });

    await browser.close();

    if (!result.peSeries.length) {
      return res.status(404).json({ error: "P/E data not found" });
    }

    res.json({
      symbol: `${symbol}.NS`,
      trailingPEHistory: result.peSeries,
      dates: result.dates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scraping error:", error.message);
    res.status(500).json({ error: "Failed to fetch P/E data" });
  }
});

//////////////////////////////////////Quick Ratio & Current Ratio//////////////////////////////////////////////////

app.get("/financial-data", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter" });
  }

  try {
    const data = await yahooFinance.quoteSummary(symbol, {
      modules: ["financialData"],
    });

    const quickRatio = data?.financialData?.quickRatio;

    res.json({
      symbol,
      quickRatio,
      fullData: data.financialData,
    });
  } catch (error) {
    console.error("Error fetching financial data:", error);
    res.status(500).json({ error: "Failed to fetch financial data" });
  }
});

/////////////////////////////////////// Shareholding //////////////////////////////////////

app.get("/shareholding-data", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter" });
  }

  try {
    const data = await yahooFinance.quoteSummary(symbol, {
      modules: ["defaultKeyStatistics"],
    });

    const heldByInstitutions = data?.defaultKeyStatistics?.heldPercentInstitutions;
    const heldByInsiders = data?.defaultKeyStatistics?.heldPercentInsiders;

    res.json({
      symbol,
      heldPercentInstitutions: heldByInstitutions,
      heldPercentInsiders: heldByInsiders,
      fullData: data.defaultKeyStatistics, // Optional, for debugging or inspection
    });
  } catch (error) {
    console.error("Error fetching shareholding data:", error);
    res.status(500).json({ error: "Failed to fetch shareholding data" });
  }
});

//////////////////////////////////////Valuations//////////////////////////////////////////

app.get('/key-statistics', async (req, res) => {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    // Add ".NS" suffix for Indian stocks if not present
    const formattedSymbol = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;

    // Fetch summary details
    const summary = await yahooFinance.quoteSummary(formattedSymbol, { modules: ['defaultKeyStatistics', 'summaryDetail'] });

    const statistics = {
      priceToBook: summary.defaultKeyStatistics?.priceToBook,
      bookValue: summary.defaultKeyStatistics?.bookValue,
      beta: summary.defaultKeyStatistics?.beta,
    };

    res.json(statistics);
  } catch (error) {
    console.error("Error fetching key statistics:", error);
    res.status(500).json({ error: "Failed to fetch key statistics" });
  }
});

////////////////////////////////Sentimental Analysis///////////////////////////////////////

const NEWS_API_KEY = "f0f4ecf43f4d495f826d8a3a26a897e5";
const GEMINI_API_KEY = "AIzaSyAYIkBf44OKp00Vb4pD395KfVl4GG_MGFw";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Sentiment Analysis Function
async function analyzeSentiment(content) {
  if (!content) return "Neutral";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      What is the sentiment of this news content? 
      Answer with one word only: Positive, Negative, or Neutral.

      "${content}"
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("❌ Gemini Error:", error.message);
    return "Neutral";
  }
}

app.get("/sentiment", async (req, res) => {
  const { stockName } = req.query;  // Change symbol to stockName
  if (!stockName) {
    return res.status(400).json({ error: "stockName is required" });  // Check if stockName is provided
  }

  const today = new Date();
  const priorDate = new Date(today.setMonth(today.getMonth() - 1));
  const fromDate = priorDate.toISOString().split("T")[0];

  const newsUrl = `https://newsapi.org/v2/everything?q=%22${encodeURIComponent(
    stockName
  )}%22&from=${fromDate}&sortBy=publishedAt&pageSize=7&language=en&apiKey=${NEWS_API_KEY}`;

  try {
    const response = await axios.get(newsUrl);
    const articles = response.data.articles;

    const analysis = [];

    for (const article of articles) {
      const { content, title, url, publishedAt } = article;
      if (!content || !title) continue;

      const sentiment = await analyzeSentiment(content);

      analysis.push({
        title,
        sentiment,
        url,
        publishedAt,
      });
    }

    // Summary Count
    const summary = {
      Positive: analysis.filter((a) => a.sentiment === "Positive").length,
      Negative: analysis.filter((a) => a.sentiment === "Negative").length,
      Neutral: analysis.filter((a) => a.sentiment === "Neutral").length,
    };

    res.json({
      status: "ok",
      stockName,  // Send stockName in the response
      fromDate,
      totalResults: analysis.length,
      summary,
      analysis,
    });
  } catch (error) {
    console.error("❌ API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch and analyze news." });
  }
});

//////////////////////////////////////Tech Score/////////////////////////////////////////////

app.get('/tech-score', async (req, res) => {
  try {
    let { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });
    if (!symbol.includes('.')) symbol += '.NS';

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 400); // enough buffer for all indicators

    const history = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    if (!history || history.length < 200) {
      return res.status(400).json({ error: "Not enough data for analysis" });
    }

    const closes = history.map(d => d.close);
    const dates = history.map(d => d.date);

    // === Golden Crossover ===
    const sma50 = [], sma200 = [];
    for (let i = 0; i < closes.length; i++) {
      sma50.push(i >= 49 ? avg(closes.slice(i - 49, i + 1)) : null);
      sma200.push(i >= 199 ? avg(closes.slice(i - 199, i + 1)) : null);
    }

    let goldenCrossoverScore = 0;
    const crossoverStart = closes.length - 100;
    for (let i = crossoverStart + 1; i < closes.length; i++) {
      if (sma50[i - 1] && sma200[i - 1]) {
        if (sma50[i - 1] < sma200[i - 1] && sma50[i] > sma200[i]) {
          goldenCrossoverScore = 10;
          break;
        }
      }
    }

    // === RSI ===
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const latestRSI = rsiValues[rsiValues.length - 1];
    let rsiScore = 0;
    if (latestRSI < 30) rsiScore = 10;
    else if (latestRSI >= 30 && latestRSI <= 70) rsiScore = 5;
    else rsiScore = 0;

    // === Std Deviation Zones ===
    const last200 = closes.slice(-200);
    const mean200 = average(last200);
    const stdDev = standardDeviation(last200);
    const latestClose = closes[closes.length - 1];

    let stdDevScore = 0;
    if (latestClose < mean200 - 3 * stdDev) stdDevScore = 10;
    else if (latestClose < mean200 - 2 * stdDev) stdDevScore = 8;
    else if (latestClose < mean200 - 1 * stdDev) stdDevScore = 6;
    else if (latestClose < mean200) stdDevScore = 4;
    else if (latestClose < mean200 + 1 * stdDev) stdDevScore = 2;
    else stdDevScore = 0;

    // === Final Score Calculation ===
    const total = goldenCrossoverScore + rsiScore + stdDevScore;
    const finalScore = ((total / 3) * 2).toFixed(2);

    res.json({
      symbol,
      latestDate: dates[dates.length - 1],
      scores: {
        goldenCrossoverScore,
        rsiScore,
        stdDevScore,
        finalScore: Number(finalScore)
      }
    });

  } catch (err) {
    console.error("❌ Error in tech-score:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

function avg(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(values) {
  const mean = average(values);
  const sqDiffs = values.map(value => (value - mean) ** 2);
  return Math.sqrt(average(sqDiffs));
}

///////////////////////////////////////Fundamental Analysis////////////////////////////////

// Utility to calculate YoY growth
function calculateGrowth(data) {
  const growthRates = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1] !== 0) {
      const growth = ((data[i] - data[i - 1]) / Math.abs(data[i - 1])) * 100;
      growthRates.push(parseFloat(growth.toFixed(2)));
    } else {
      growthRates.push(0); // Avoid division by zero
    }
  }
  return growthRates;
}

// Utility to assign score based on growth patterns
function getScore(growthArr) {
  const moreThan20 = growthArr.map(g => g > 20);
  const between0and20 = growthArr.map(g => g > 0 && g <= 20);

  let high = 0;
  let low = 0;

  const countConsecutive = (arr) => {
    let count = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i]) count++;
      else break;
    }
    return count;
  };

  high = countConsecutive(moreThan20);
  low = countConsecutive(between0and20);

  if (high === 3) return 10;
  if (high === 2) return 5;
  if (high === 1) return 3;

  if (low === 3) return 7.5;
  if (low === 2) return 3.33;
  if (low === 1) return 2.33;

  return 0;
}

// Route to fetch and calculate fundamental score
app.get("/fundamental-score", async (req, res) => {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ["incomeStatementHistory"]
    });

    const incomeStatements = result?.incomeStatementHistory?.incomeStatementHistory;
    if (!incomeStatements || !Array.isArray(incomeStatements)) {
      return res.status(404).json({ error: "Income statement data not available" });
    }

    // Extract last 4 years of revenue and profit
    const sales = incomeStatements
      .map(item => item.totalRevenue?.raw ?? item.totalRevenue ?? 0)
      .slice(0, 4)
      .reverse();

    const profit = incomeStatements
      .map(item => item.netIncome?.raw ?? item.netIncome ?? 0)
      .slice(0, 4)
      .reverse();

    const years = incomeStatements
      .map(item => new Date(item.endDate).getFullYear())
      .slice(0, 4)
      .reverse();

    const salesGrowth = calculateGrowth(sales);
    const profitGrowth = calculateGrowth(profit);

    const salesScore = getScore(salesGrowth);
    const profitScore = getScore(profitGrowth);
    const totalFundamentalScore = salesScore + profitScore;

    return res.json({
      symbol,
      years,
      sales,
      profit,
      salesGrowth,
      profitGrowth,
      salesScore,
      profitScore,
      totalFundamentalScore
    });

  } catch (error) {
    console.error("❌ Error fetching data:", error.message);
    return res.status(500).json({ error: "Failed to fetch data from Yahoo Finance" });
  }
});

////////////////////////////////////////Shareholding-Equimeter//////////////////////////////////////////

// Utility to calculate shareholding score
function calculateShareholdingScore(promoter, ii) {
  let score = 0;

  // Convert promoter and ii to percentage (multiply by 100)
  const promoterPercentage = promoter * 100;
  const iiPercentage = ii * 100;

  // Promoter > 50% => +10 points
  if (promoterPercentage > 50) {
    score += 10;
  }

  // Institutional Investors (II) > 50% => +10 points
  if (iiPercentage > 50) {
    score += 10;
  }
  // Institutional Investors (II) > 25% => +7 points
  else if (iiPercentage > 25) {
    score += 7;
  }
  // Institutional Investors (II) > 10% => +5 points
  else if (iiPercentage > 10) {
    score += 5;
  }
  // Institutional Investors (II) > 0% => +3 points
  else if (iiPercentage > 0) {
    score += 3;
  }

  return score;
}

// New Route to get shareholding data and calculate Shareholding-Equimeter score
app.get("/shareholding-equimeter", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter" });
  }

  try {
    const data = await yahooFinance.quoteSummary(symbol, {
      modules: ["defaultKeyStatistics"],
    });

    const heldByInstitutions = data?.defaultKeyStatistics?.heldPercentInstitutions || 0;
    const heldByInsiders = data?.defaultKeyStatistics?.heldPercentInsiders || 0;

    const shareholdingScore = calculateShareholdingScore(heldByInsiders, heldByInstitutions);

    res.json({
      symbol,
      heldPercentInstitutions: heldByInstitutions * 100, // Convert to percentage
      heldPercentInsiders: heldByInsiders * 100,       // Convert to percentage
      shareholdingScore,
    });
  } catch (error) {
    console.error("Error fetching shareholding data:", error);
    res.status(500).json({ error: "Failed to fetch shareholding data" });
  }
});

/////////////////////////////////////////Valuation////////////////////////////////////////

app.get("/peg-ratio", async (req, res) => {
  const symbol = req.query.symbol;
  if (!symbol) {
    return res.status(400).json({ error: "Missing symbol parameter" });
  }

  try {
    // Get PE Ratio
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["summaryDetail"],
    });

    const peRatio = summary?.summaryDetail?.trailingPE;
    if (!peRatio) {
      return res.status(404).json({ error: "PE ratio not available" });
    }

    // Get Profit Data
    const financials = await yahooFinance.quoteSummary(symbol, {
      modules: ["incomeStatementHistory"],
    });

    const incomeStatements = financials?.incomeStatementHistory?.incomeStatementHistory;
    if (!incomeStatements || incomeStatements.length < 2) {
      return res.status(404).json({ error: "Not enough income statement data" });
    }

    const profitLatest = incomeStatements[0]?.netIncome || 0;
    const profitPrev = incomeStatements[1]?.netIncome || 0;

    if (profitLatest === 0 || profitPrev === 0) {
      return res.status(404).json({ error: "Invalid profit data" });
    }

    // Calculate Profit Growth %
    const profitGrowthRate = ((profitLatest - profitPrev) / profitPrev) * 100;

    let pegRatio = null;
    let pegScore = 0;

    if (profitGrowthRate > 0) {
      pegRatio = peRatio / profitGrowthRate;

      // Scoring
      if (pegRatio > 0 && pegRatio <= 1) {
        pegScore = 20;
      } else if (pegRatio > 1 && pegRatio <= 1.5) {
        pegScore = 10;
      } else if (pegRatio > 1.5 && pegRatio <= 2) {
        pegScore = 5;
      } else {
        pegScore = 0;
      }
    }

    res.json({
      symbol,
      peRatio,
      profitGrowthRate: +profitGrowthRate.toFixed(2),
      pegRatio: pegRatio !== null ? +pegRatio.toFixed(2) : null,
      pegScore,
    });

  } catch (error) {
    console.error("Error calculating PEG ratio:", error.message);
    res.status(500).json({ error: "Failed to calculate PEG ratio" });
  }
});

// ////////////////////////////////////PROMOTER///////////////////////////////////////////


// const scrapeShareholdingData = async (url, stockName) => {
//   console.log(`🔍 Scraping: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let FIIs = [], DIIs = [], Promoters = [], Government = [], years = [];
//     let foundData = false;

//     const tables = $("table.data-table");
//     if (!tables.length) {
//       console.log("⚠️ No financial tables found.");
//       return null;
//     }

//     tables.each((_, table) => {
//       let tableYears = [];
//       $(table).find("thead th").each((i, el) => {
//         if (i > 0) tableYears.push($(el).text().trim());
//       });

//       console.log("📅 Extracted Years:", tableYears);

//       $(table).find("tr").each((_, row) => {
//         const cols = $(row).find("td");
//         const rowHeader = $(cols[0]).text().trim();
//         const rowValues = cols.map((i, col) => (i > 0 ? parseFloat($(col).text().replace(/,/g, "")) || 0 : null)).get();

//         if (rowHeader.includes("FIIs")) {
//           foundData = true;
//           FIIs = rowValues;
//           years = tableYears;
//         }

//         if (rowHeader.includes("DIIs")) DIIs = rowValues;
//         if (rowHeader.includes("Promoters")) Promoters = rowValues;
//         if (rowHeader.includes("Government")) Government = rowValues;

//         console.log(`📊 ${rowHeader}:`, rowValues);
//       });
//     });

//     if (!foundData) return null;

//     return { stockName, years, FIIs, DIIs, Promoters, Government };
//   } catch (error) {
//     console.error(`❌ Error scraping ${url}:`, error.message);
//     return null;
//   }
// };

// app.get("/shareholding", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   let shareholdingData = await scrapeShareholdingData(`https://www.screener.in/company/${stockName}/consolidated/`, stockName);

//   if (!shareholdingData) {
//     return res.status(404).json({ error: "Shareholding data not available" });
//   }

//   res.json(shareholdingData);
// });

// app.listen(5000, () => console.log("🚀 Server running on port 5000"));

// //////////////////////////////////////////PE RATIO//////////////////////////////////////////////

// app.get("/historical-pe-scrape", async (req, res) => {
//   const { symbol } = req.query;

//   if (!symbol) {
//     return res.status(400).json({ error: "Missing stock symbol" });
//   }

//   const url = `https://finance.yahoo.com/quote/${symbol}.NS/key-statistics`;

//   try {
//     const browser = await puppeteer.launch({
//       headless: "new",
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//     });

//     const page = await browser.newPage();

//     // Optional: Block images/styles/fonts for faster load
//     await page.setRequestInterception(true);
//     page.on("request", (req) => {
//       const resourceType = req.resourceType();
//       if (["image", "stylesheet", "font"].includes(resourceType)) {
//         req.abort();
//       } else {
//         req.continue();
//       }
//     });

//     await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

//     await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

//     await page.waitForSelector("section[data-testid='qsp-statistics']", {
//       timeout: 15000,
//     });

//     const result = await page.evaluate(() => {
//       const data = {
//         peSeries: [],
//         dates: [],
//       };

//       const tables = document.querySelectorAll(
//         "section[data-testid='qsp-statistics'] table"
//       );

//       tables.forEach((table) => {
//         const rows = table.querySelectorAll("tr");
//         rows.forEach((row) => {
//           const cells = row.querySelectorAll("td");
//           if (cells.length > 1 && cells[0].innerText.includes("Trailing P/E")) {
//             cells.forEach((cell, idx) => {
//               if (idx !== 0) {
//                 const val = cell.innerText.trim();
//                 if (val !== "--" && !isNaN(parseFloat(val))) {
//                   data.peSeries.push(parseFloat(val));
//                 }
//               }
//             });
//           }
//         });
//       });

//       const headerRow = document.querySelector(
//         "section[data-testid='qsp-statistics'] table thead tr"
//       );
//       if (headerRow) {
//         headerRow.querySelectorAll("th").forEach((th, idx) => {
//           if (idx !== 0) {
//             const date = th.innerText.trim();
//             if (date) data.dates.push(date);
//           }
//         });
//       }

//       return data;
//     });

//     await browser.close();

//     if (!result.peSeries.length) {
//       return res.status(404).json({ error: "P/E data not found" });
//     }

//     res.json({
//       symbol: `${symbol}.NS`,
//       trailingPEHistory: result.peSeries,
//       dates: result.dates,
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error("Scraping error:", error.message);
//     res.status(500).json({ error: "Failed to fetch P/E data" });
//   }
// });

// ///////////////////////////////////////EPS DPS//////////////////////////////////////

// // EPS and Dividend Scraper
// const scrapeEpsDividendData = async (url, stockName) => {
//   console.log(`🔍 Scraping EPS and Dividend Payout: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let EPS = [],
//       DividendPayout = [],
//       years = [];
//     let foundEPS = false;

//     const profitLossSection = $("#profit-loss");
//     if (!profitLossSection.length) {
//       console.log("❌ Profit & Loss section not found.");
//       return null;
//     }

//     const table = profitLossSection.find("table.data-table").first();
//     if (!table.length) {
//       console.log("❌ No financial table inside Profit & Loss.");
//       return null;
//     }

//     table.find("thead th").each((i, el) => {
//       if (i > 0) years.push($(el).text().trim());
//     });

//     table.find("tbody tr").each((_, row) => {
//       const cols = $(row).find("td");
//       const rowHeader = $(cols[0]).text().trim();

//       const rowValues = cols
//         .map((i, col) =>
//           i > 0 ? parseFloat($(col).text().replace(/,/g, "")) || 0 : null
//         )
//         .get();

//       if (rowHeader.includes("EPS in Rs")) {
//         EPS = rowValues;
//         foundEPS = true;
//       }

//       if (rowHeader.includes("Dividend Payout")) {
//         DividendPayout = rowValues;
//       }
//     });

//     if (!foundEPS) return null;

//     return { stockName, years, EPS, DividendPayout };
//   } catch (error) {
//     console.error(`❌ Error scraping ${url}:`, error.message);
//     return null;
//   }
// };

// // API Endpoint
// app.get("/eps-dividend", async (req, res) => {
//   const { symbol } = req.query;

//   if (!symbol) {
//     return res.status(400).json({ error: "Symbol is required" });
//   }

//   const stockName = symbol.replace(".NS", "");
//   const url = `https://www.screener.in/company/${stockName}/consolidated/`;

//   const result = await scrapeEpsDividendData(url, stockName);

//   if (!result) {
//     return res
//       .status(404)
//       .json({ error: "EPS and Dividend data not available" });
//   }

//   res.json(result);
// });

// // Start server
// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });


// ////////////////////////////////////////////////ROCE/////////////////////////////////////////////

// // ROCE Scraper
// const scrapeRoceData = async (url, stockName) => {
//   console.log(`🔍 Scraping ROCE % data: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let ROCE = [], years = [];

//     const tables = $("table.data-table");
//     if (!tables.length) return null;

//     tables.each((_, table) => {
//       let tableYears = [];
//       $(table)
//         .find("thead th")
//         .each((i, el) => {
//           if (i > 0) tableYears.push($(el).text().trim());
//         });

//       $(table)
//         .find("tr")
//         .each((_, row) => {
//           const cols = $(row).find("td");
//           const rowHeader = $(cols[0]).text().trim();
//           const rowValues = cols
//             .map((i, col) =>
//               i > 0 ? parseFloat($(col).text().replace(/,/g, "")) || 0 : null
//             )
//             .get();

//           if (rowHeader.includes("ROCE %")) {
//             ROCE = rowValues;
//             years = tableYears;
//           }
//         });
//     });

//     if (!ROCE.length) return null;

//     return { stockName, years, ROCE };
//   } catch (error) {
//     console.error(`❌ Error scraping ROCE from ${url}:`, error.message);
//     return null;
//   }
// };

// // ROCE Endpoint
// app.get("/roce", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const url = `https://www.screener.in/company/${stockName}/consolidated/`;

//   const result = await scrapeRoceData(url, stockName);
//   if (!result)
//     return res.status(404).json({ error: "ROCE data not available" });

//   res.json(result);
// });

// ///////////////////////////////////ROE////////////////////////////////////////////////

// // ROE Scraper
// const scrapeRoeData = async (url, stockName) => {
//   console.log(`🔍 Scraping ROE % data: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let ROE = [], years = [];

//     const tables = $("table.data-table");
//     if (!tables.length) return null;

//     tables.each((_, table) => {
//       let tableYears = [];
//       $(table)
//         .find("thead th")
//         .each((i, el) => {
//           if (i > 0) tableYears.push($(el).text().trim());
//         });

//       $(table)
//         .find("tr")
//         .each((_, row) => {
//           const cols = $(row).find("td");
//           const rowHeader = $(cols[0]).text().trim();
//           const rowValues = cols
//             .map((i, col) =>
//               i > 0 ? parseFloat($(col).text().replace(/,/g, "")) || 0 : null
//             )
//             .get();

//           if (rowHeader.includes("ROE %")) {
//             ROE = rowValues;
//             years = tableYears;
//           }
//         });
//     });

//     if (!ROE.length) return null;

//     return { stockName, years, ROE };
//   } catch (error) {
//     console.error(`❌ Error scraping ROE from ${url}:`, error.message);
//     return null;
//   }
// };

// // ROE Endpoint
// app.get("/roe", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const url = `https://www.screener.in/company/${stockName}/consolidated/`;

//   const result = await scrapeRoeData(url, stockName);
//   if (!result)
//     return res.status(404).json({ error: "ROE data not found" });

//   res.json(result);
// });

// /////////////////////////////////////PE of Stock/////////////////////////////////////////////

// const scrapePeRatio = async (url, stockName) => {
//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);

//     let peRatio = null;

//     // Try to find "Stock P/E"
//     $("li:contains('Stock P/E')").each((_, el) => {
//       const text = $(el).text();
//       const match = text.match(/Stock P\/E\s*([\d.]+)/);
//       if (match) {
//         peRatio = parseFloat(match[1]);
//         return false; // break loop once found
//       }
//     });

//     if (!peRatio) return null;
//     return { stockName, peRatio };
//   } catch (error) {
//     console.error("❌ Error fetching data from:", url, "\n", error.message);
//     return null;
//   }
// };

// app.get("/pe-ratio", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const consolidatedUrl = `https://www.screener.in/company/${stockName}/consolidated/`;
//   const fallbackUrl = `https://www.screener.in/company/${stockName}/`;

//   // Try consolidated page first
//   let result = await scrapePeRatio(consolidatedUrl, stockName);

//   // If not found, try fallback
//   if (!result) {
//     console.log(`📉 Falling back to overview page for ${stockName}`);
//     result = await scrapePeRatio(fallbackUrl, stockName);
//   }

//   if (!result) {
//     return res.status(404).json({ error: "P/E ratio not found" });
//   }

//   res.json(result);
// });

// ////////////////////////////////////////////Stock PBV//////////////////////////////////////////////////

// const scrapePBV = async (url, stockName) => {
//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let currentPrice = null;
//     let bookValue = null;

//     $("ul#top-ratios li").each((_, el) => {
//       const label = $(el).find("span.name").text().replace(/\s+/g, " ").trim();

//       if (label === "Current Price") {
//         const text = $(el).find("span.number").text().replace(/[^0-9.]/g, "").trim();
//         if (text) currentPrice = parseFloat(text);
//       }

//       if (label === "Book Value") {
//         const text = $(el).find("span.number").text().replace(/[^0-9.]/g, "").trim();
//         if (text) bookValue = parseFloat(text);
//       }
//     });

//     if (!currentPrice || !bookValue || bookValue === 0) return null;

//     const pbv = (currentPrice / bookValue).toFixed(2) + "x";
//     return { stockName, pbv };
//   } catch (error) {
//     console.error("❌ Error fetching PBV from:", url, "\n", error.message);
//     return null;
//   }
// };

// // Route
// app.get("/pbv", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const consolidatedUrl = `https://www.screener.in/company/${stockName}/consolidated/`;
//   const fallbackUrl = `https://www.screener.in/company/${stockName}/`;

//   let result = await scrapePBV(consolidatedUrl, stockName);
//   if (!result) {
//     console.log(`📉 Falling back to overview page for ${stockName}`);
//     result = await scrapePBV(fallbackUrl, stockName);
//   }

//   if (!result) {
//     return res.status(404).json({ error: "Price to Book Value not found" });
//   }

//   res.json(result);
// });

// /////////////////////////////////////////////Industry PE/////////////////////////////////////////////

// // Helper function to calculate median
// const getMedian = (values) => {
//   const nums = values.filter((v) => !isNaN(v)).sort((a, b) => a - b);
//   const len = nums.length;
//   if (len === 0) return null;
//   const mid = Math.floor(len / 2);
//   return len % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
// };

// // Route to scrape Peer Comparison table
// app.get("/peer-comparison", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const consolidatedUrl = `https://www.screener.in/company/${stockName}/consolidated/`;
//   const fallbackUrl = `https://www.screener.in/company/${stockName}/`;

//   try {
//     let result = await scrapePeerComparisonDynamic(consolidatedUrl, stockName);

//     // Fallback if first URL fails
//     if (!result || !result.peerComparison || result.peerComparison.rows.length === 0) {
//       console.log(`📉 Falling back to overview for ${stockName}`);
//       result = await scrapePeerComparisonDynamic(fallbackUrl, stockName);
//     }

//     if (!result || !result.peerComparison || result.peerComparison.rows.length === 0) {
//       return res.status(404).json({ error: "Peer Comparison table not found" });
//     }

//     // Extract P/E ratios from 4th column (index 3) and compute median
//     const peRatios = result.peerComparison.rows
//       .map((row) => parseFloat(row[3]))
//       .filter((pe) => !isNaN(pe));

//     const medianPe = getMedian(peRatios);

//     res.json({
//       ...result,
//       medianPeRatio: medianPe,
//     });
//   } catch (error) {
//     console.error("❌ Error scraping peer comparison:", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// // Puppeteer-based dynamic scraper for Peer Comparison table
// const scrapePeerComparisonDynamic = async (url, stockName) => {
//   const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
//   const page = await browser.newPage();

//   await page.goto(url, {
//     waitUntil: "networkidle2",
//     timeout: 0,
//   });

//   try {
//     // Wait for peer comparison table to load
//     await page.waitForSelector("#peers table", { timeout: 10000 });

//     const peerComparison = await page.evaluate(() => {
//       const headers = Array.from(document.querySelectorAll("#peers table thead th")).map(
//         (th) => th.innerText.trim()
//       );

//       const rows = Array.from(document.querySelectorAll("#peers table tbody tr")).map((tr) =>
//         Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.trim())
//       );

//       return { headers, rows };
//     });

//     await browser.close();

//     return { stockName, peerComparison };
//   } catch (error) {
//     await browser.close();
//     console.error("❌ Error in puppeteer evaluation:", error.message);
//     return null;
//   }
// };

// /////////////////////////////////////////////////////////PEG Ratio/////////////////////////////////////////////////////////////////////

// // Correct PEG Ratio Endpoint (PEG = PE / EPS Growth)
// app.get("/peg-ratio", async (req, res) => {
//   const { symbol } = req.query;

//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const baseUrls = [
//     `https://www.screener.in/company/${stockName}/consolidated/`,
//     `https://www.screener.in/company/${stockName}/` // fallback
//   ];

//   let peResult = null;
//   let epsResult = null;
//   let workingUrl = null;

//   try {
//     // Step 1: Try both URLs until one works
//     for (const url of baseUrls) {
//       if (!peResult) peResult = await scrapePeRatio(url, stockName);
//       if (!epsResult) epsResult = await scrapeEpsDividendData(url, stockName);
//       if (peResult && epsResult && epsResult.EPS.length >= 2) {
//         workingUrl = url;
//         break;
//       }
//     }

//     if (!peResult || !peResult.peRatio) {
//       return res.status(404).json({ error: "P/E ratio not found" });
//     }

//     if (!epsResult || !epsResult.EPS || epsResult.EPS.length < 2) {
//       return res.status(404).json({ error: "Not enough valid EPS data" });
//     }

//     const epsValues = epsResult.EPS;
//     const epsYears = epsResult.years;

//     const epsLatest = epsValues[epsValues.length - 1];     // TTM
//     const epsPrevious = epsValues[epsValues.length - 2];   // Last full year

//     if (epsPrevious === 0) {
//       return res.status(400).json({ error: "Previous EPS is zero, cannot calculate growth" });
//     }

//     const epsGrowth = ((epsLatest - epsPrevious) / Math.abs(epsPrevious)) * 100;

//     if (epsGrowth === 0) {
//       return res.status(400).json({ error: "EPS growth is zero, PEG cannot be calculated" });
//     }

//     const pegRatio = peResult.peRatio / epsGrowth;

//     res.json({
//       stockName,
//       source: workingUrl,
//       epsYears: [epsYears[epsYears.length - 2], epsYears[epsYears.length - 1]],
//       epsPrevious: epsPrevious.toFixed(2),
//       epsLatest: epsLatest.toFixed(2),
//       epsGrowth: epsGrowth.toFixed(2) + " %",
//       peRatio: peResult.peRatio.toFixed(2),
//       pegRatio: pegRatio.toFixed(2)
//     });
//   } catch (err) {
//     console.error("❌ Error calculating PEG ratio:", err.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });


// //////////////////////////////////////////////////////Golden Cross Over ////////////////////////////////////////////////////////////////////////

// app.get('/golden-crossover', async (req, res) => {
//   try {
//     let { symbol } = req.query;
//     if (!symbol) return res.status(400).json({ error: "Symbol is required" });
//     if (!symbol.includes('.')) symbol += '.NS';

//     const endDate = new Date();
//     const startDate = new Date();
//     startDate.setDate(endDate.getDate() - 400); // buffer for SMA calculation

//     const history = await yahooFinance.historical(symbol, {
//       period1: startDate,
//       period2: endDate,
//       interval: '1d'
//     });

//     if (!history || history.length < 200) {
//       return res.status(400).json({ error: "Not enough data to compute SMAs" });
//     }

//     const closes = history.map(d => d.close);
//     const dates = history.map(d => d.date);

//     // Calculate SMA-50 and SMA-200
//     const sma50 = [], sma200 = [];
//     for (let i = 0; i < closes.length; i++) {
//       sma50.push(i >= 49 ? avg(closes.slice(i - 49, i + 1)) : null);
//       sma200.push(i >= 199 ? avg(closes.slice(i - 199, i + 1)) : null);
//     }

//     // Detect crossovers in the last 100 days
//     const crossoverStart = closes.length - 100;
//     const goldenCrossDates = [];
//     const deathCrossDates = [];

//     for (let i = crossoverStart + 1; i < closes.length; i++) {
//       if (sma50[i - 1] == null || sma200[i - 1] == null) continue;

//       const prev50 = sma50[i - 1], curr50 = sma50[i];
//       const prev200 = sma200[i - 1], curr200 = sma200[i];

//       // Golden Cross: 50-DMA crosses above 200-DMA
//       if (prev50 < prev200 && curr50 > curr200) {
//         goldenCrossDates.push(dates[i]);
//       }

//       // Death Cross: 50-DMA crosses below 200-DMA
//       if (prev50 > prev200 && curr50 < curr200) {
//         deathCrossDates.push(dates[i]);
//       }
//     }

//     res.json({
//       symbol,
//       goldenCrossover: goldenCrossDates.length > 0 ? "Yes" : "No",
//       latestGoldenCross: goldenCrossDates.at(-1) || null,
//       totalGoldenCrossoversInLast100Days: goldenCrossDates.length,
//       goldenCrossDates,

//       deathCrossover: deathCrossDates.length > 0 ? "Yes" : "No",
//       latestDeathCross: deathCrossDates.at(-1) || null,
//       totalDeathCrossoversInLast100Days: deathCrossDates.length,
//       deathCrossDates
//     });

//   } catch (err) {
//     console.error("❌ Golden/Death crossover error:", err.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// function avg(arr) {
//   return arr.reduce((sum, val) => sum + val, 0) / arr.length;
// }

// /////////////////////////////////////////////////Standard Deviation//////////////////////////////////////////

// app.get('/std-deviation-zones', async (req, res) => {
//   try {
//     let { symbol } = req.query;
//     if (!symbol) return res.status(400).json({ error: "Symbol is required" });
//     if (!symbol.includes('.')) symbol += '.NS';

//     const endDate = new Date();
//     const startDate = new Date();
//     startDate.setDate(endDate.getDate() - 300);

//     const historical = await yahooFinance.historical(symbol, {
//       period1: startDate,
//       period2: endDate,
//       interval: '1d',
//     });

//     if (!historical || historical.length < 200) {
//       return res.status(400).json({ error: "Not enough data to calculate 200-DMA" });
//     }

//     const closes = historical.map(item => item.close);
//     const dates = historical.map(item => item.date);

//     const last200 = closes.slice(-200);
//     const mean200 = average(last200);
//     const stdDev = standardDeviation(last200);
//     const latestClose = closes[closes.length - 1];

//     // Define zone thresholds
//     const thresholds = {
//       lower3: mean200 - 3 * stdDev,
//       lower2: mean200 - 2 * stdDev,
//       lower1: mean200 - 1 * stdDev,
//       upper1: mean200 + 1 * stdDev,
//       upper2: mean200 + 2 * stdDev,
//       upper3: mean200 + 3 * stdDev
//     };

//     let zone = "";
//     if (latestClose < thresholds.lower3) {
//       zone = "Zone A (Below -3σ) - Very Oversold";
//     } else if (latestClose < thresholds.lower2) {
//       zone = "Zone B (-3σ to -2σ)";
//     } else if (latestClose < thresholds.lower1) {
//       zone = "Zone C (-2σ to -1σ)";
//     } else if (latestClose < mean200) {
//       zone = "Zone D (-1σ to Mean)";
//     } else if (latestClose < thresholds.upper1) {
//       zone = "Zone E (Mean to +1σ)";
//     } else if (latestClose < thresholds.upper2) {
//       zone = "Zone F (+1σ to +2σ)";
//     } else if (latestClose < thresholds.upper3) {
//       zone = "Zone G (+2σ to +3σ)";
//     } else {
//       zone = "Zone H (Above +3σ) - Very Overbought";
//     }

//     res.json({
//       symbol,
//       latestDate: dates[dates.length - 1],
//       latestClose: latestClose.toFixed(2),
//       dma200: mean200.toFixed(2),
//       stdDev: stdDev.toFixed(2),
//       zone
//     });
//   } catch (error) {
//     console.error("❌ Error in SD zone analysis:", error.message);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// function average(arr) {
//   return arr.reduce((a, b) => a + b, 0) / arr.length;
// }

// function standardDeviation(values) {
//   const mean = average(values);
//   const sqDiffs = values.map(value => (value - mean) ** 2);
//   return Math.sqrt(average(sqDiffs));
// }

// //////////////////////////////////////////////RSI Data//////////////////////////////////////////////////

// // RSI API endpoint
// app.get('/rsi-data', async (req, res) => {
//   try {
//     let { symbol } = req.query;

//     if (!symbol) {
//       return res.status(400).json({ error: "Symbol is required" });
//     }

//     if (!symbol.includes('.')) {
//       symbol += '.NS'; // Assume NSE by default
//     }

//     // Get 6 months of daily data
//     const result = await yahooFinance.historical(symbol, {
//       period1: Math.floor((Date.now() - 200 * 24 * 60 * 60 * 1000) / 1000),
//       period2: Math.floor(Date.now() / 1000),
//       interval: '1d',
//     });

//     const closes = result.map(entry => entry.close);
//     const dates = result.map(entry => entry.date);

//     // Calculate RSI with a 14-day window
//     const rsiValues = RSI.calculate({ period: 14, values: closes });

//     // Align dates (RSI starts after 14 days)
//     const alignedRSI = rsiValues.map((rsi, i) => ({
//       date: dates[i + (closes.length - rsiValues.length)],
//       rsi: parseFloat(rsi.toFixed(2))
//     }));

//     res.json({
//       symbol,
//       latestRSI: alignedRSI[alignedRSI.length - 1],
//       history: alignedRSI
//     });

//   } catch (error) {
//     console.error("❌ Error fetching RSI:", error.message);
//     res.status(500).json({ error: "Failed to calculate RSI" });
//   }
// });

// ///////////////////////////////////Sales Growth///////////////////////////////////////

// // API Route
// const scrapeSalesData = async (url, stockName) => {
//   console.log(`🔍 Trying URL: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     const table = $("table.data-table");

//     if (!table.length) {
//       console.log("⚠️ No financial table found at", url);
//       return null;
//     }

//     let sales = [];
//     table.find("tbody tr").each((index, row) => {
//       const cols = $(row).find("td");
//       const rowHeader = $(cols[0]).text().trim();

//       if (rowHeader.includes("Revenue") || rowHeader.includes("Sales")) {
//         cols.each((i, col) => {
//           if (i > 0) {
//             sales.push(parseFloat($(col).text().replace(/,/g, "")) || 0);
//           }
//         });
//       }
//     });

//     if (sales.length === 0) {
//       console.log("⚠️ No sales data extracted.");
//       return null;
//     }

//     let currentYear = new Date().getFullYear();
//     let years = sales.map((_, i) => currentYear - (sales.length - 1 - i));

//     return { stockName, sales, years };
//   } catch (error) {
//     console.error(`❌ Error scraping ${url}:`, error.message);
//     return null;
//   }
// };

// // ✅ API to check sales growth
// app.get("/sales-growth/:symbol", async (req, res) => {
//   let { symbol } = req.params;
//   const stockName = symbol.replace(".NS", "");

//   // Try consolidated page first
//   let financialData = await scrapeSalesData(`https://www.screener.in/company/${stockName}/consolidated/`, stockName);

//   // Fallback to basic page
//   if (!financialData) {
//     console.log(`🔄 Retrying with basic URL for ${stockName}...`);
//     financialData = await scrapeSalesData(`https://www.screener.in/company/${stockName}/`, stockName);
//   }

//   if (!financialData) {
//     return res.status(404).json({ error: "Sales data not available" });
//   }

//   const { sales, years } = financialData;

//   const isIncreasing = (arr) => arr.every((val, i, a) => i === 0 || val > a[i - 1]);

//   const len = sales.length;
//   let growth = {
//     "1yr": false,
//     "3yr": false,
//     "5yr": false
//   };

//   if (len >= 2 && sales[len - 1] > sales[len - 2]) {
//     growth["1yr"] = true;
//   }

//   if (len >= 4 && isIncreasing(sales.slice(len - 3))) {
//     growth["3yr"] = true;
//   }

//   if (len >= 6 && isIncreasing(sales.slice(len - 5))) {
//     growth["5yr"] = true;
//   }

//   res.json({
//     stockName,
//     years,
//     sales,
//     growthFlags: growth
//   });
// });

// //////////////////////////////////Profit Growth/////////////////////////////////////////

// const scrapeProfitData = async (url, stockName) => {
//   console.log(`🔍 Trying URL: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     const table = $("table.data-table");

//     if (!table.length) {
//       console.log("⚠️ No financial table found at", url);
//       return null;
//     }

//     let profit = [];
//     table.find("tbody tr").each((index, row) => {
//       const cols = $(row).find("td");
//       const rowHeader = $(cols[0]).text().trim();

//       if (rowHeader.includes("Net Profit") || rowHeader.includes("Profit After Tax")) {
//         cols.each((i, col) => {
//           if (i > 0) {
//             profit.push(parseFloat($(col).text().replace(/,/g, "")) || 0);
//           }
//         });
//       }
//     });

//     if (profit.length === 0) {
//       console.log("⚠️ No profit data extracted.");
//       return null;
//     }

//     let currentYear = new Date().getFullYear();
//     let years = profit.map((_, i) => currentYear - (profit.length - 1 - i));

//     return { stockName, profit, years };
//   } catch (error) {
//     console.error(`❌ Error scraping ${url}:`, error.message);
//     return null;
//   }
// };

// // ✅ API to check profit growth
// app.get("/profit-growth/:symbol", async (req, res) => {
//   let { symbol } = req.params;
//   const stockName = symbol.replace(".NS", "");

//   // Try consolidated page first
//   let financialData = await scrapeProfitData(`https://www.screener.in/company/${stockName}/consolidated/`, stockName);

//   // Fallback to basic page
//   if (!financialData) {
//     console.log(`🔄 Retrying with basic URL for ${stockName}...`);
//     financialData = await scrapeProfitData(`https://www.screener.in/company/${stockName}/`, stockName);
//   }

//   if (!financialData) {
//     return res.status(404).json({ error: "Profit data not available" });
//   }

//   const { profit, years } = financialData;

//   const isIncreasing = (arr) => arr.every((val, i, a) => i === 0 || val > a[i - 1]);

//   const len = profit.length;
//   let growth = {
//     "1yr": false,
//     "3yr": false,
//     "5yr": false
//   };

//   if (len >= 2 && profit[len - 1] > profit[len - 2]) {
//     growth["1yr"] = true;
//   }

//   if (len >= 4 && isIncreasing(profit.slice(len - 3))) {
//     growth["3yr"] = true;
//   }

//   if (len >= 6 && isIncreasing(profit.slice(len - 5))) {
//     growth["5yr"] = true;
//   }

//   res.json({
//     stockName,
//     years,
//     profit,
//     growthFlags: growth
//   });
// });

// ////////////////////////////////////////////////Borrowing & Sales ////////////////////////////////////////////////////////////////

// const scrapeBorrowingAndSalesData = async (symbol) => {
//   const stockName = symbol.toUpperCase();
//   const url = `https://www.screener.in/company/${stockName}/consolidated/`;
//   console.log(`🔍 Scraping: ${url}`);

//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     const table = $("table.data-table");

//     if (!table.length) {
//       console.log("⚠️ No financial table found at", url);
//       return null;
//     }

//     let sales = [];
//     let borrowings = [];

//     table.find("tbody tr").each((index, row) => {
//       const cols = $(row).find("td");
//       const rowHeader = $(cols[0]).text().trim().toLowerCase();

//       if (rowHeader.includes("revenue") || rowHeader.includes("sales")) {
//         cols.each((i, col) => {
//           if (i > 0) {
//             sales.push(parseFloat($(col).text().replace(/,/g, "")) || 0);
//           }
//         });
//       }

//       if (
//         rowHeader.includes("borrowings") ||
//         rowHeader.includes("borrowing") ||
//         rowHeader.includes("borrowings +") ||
//         rowHeader.includes("secured loans") ||
//         rowHeader.includes("total debt")
//       ) {
//         cols.each((i, col) => {
//           if (i > 0) {
//             borrowings.push(parseFloat($(col).text().replace(/,/g, "")) || 0);
//           }
//         });
//       }
//     });

//     if (sales.length === 0 || borrowings.length === 0) {
//       console.log("⚠️ No sales or borrowings data extracted.");
//       return null;
//     }

//     // Compute years from current year
//     let currentYear = new Date().getFullYear();
//     let years = sales.map((_, i) => currentYear - (sales.length - 1 - i));

//     const calcTotalGrowthRate = (arr, period) => {
//       if (arr.length < period + 1) return null;
//       const start = arr[arr.length - period - 1];
//       const end = arr[arr.length - 1];
//       return (end - start) / (start || 1); // avoid division by zero
//     };

//     const salesGrowth5Yrs = calcTotalGrowthRate(sales, 5);
//     const borrowingsGrowth5Yrs = calcTotalGrowthRate(borrowings, 5);

//     const salesGrowth3Yrs = calcTotalGrowthRate(sales, 3);
//     const borrowingsGrowth3Yrs = calcTotalGrowthRate(borrowings, 3);

//     const borrowingRateBeatsSales5Yrs =
//       borrowingsGrowth5Yrs !== null && salesGrowth5Yrs !== null && borrowingsGrowth5Yrs > salesGrowth5Yrs;

//     const borrowingRateBeatsSales3Yrs =
//       borrowingsGrowth3Yrs !== null && salesGrowth3Yrs !== null && borrowingsGrowth3Yrs > salesGrowth3Yrs;

//     return {
//       stockName,
//       years,
//       sales,
//       borrowings,
//       growthComparison: {
//         salesGrowth5Yrs,
//         borrowingsGrowth5Yrs,
//         salesGrowth3Yrs,
//         borrowingsGrowth3Yrs,
//         borrowingRateBeatsSales5Yrs,
//         borrowingRateBeatsSales3Yrs,
//       },
//     };
//   } catch (error) {
//     console.error(`❌ Scraping failed for ${symbol}:`, error.message);
//     return null;
//   }
// };

// app.get("/borrow-sales", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) {
//     return res.status(400).json({ error: "Symbol query parameter is required" });
//   }

//   const result = await scrapeBorrowingAndSalesData(symbol);
//   if (!result) {
//     return res.status(500).json({ error: "Failed to scrape data" });
//   }

//   res.json(result);
// });


// //////////////////////////////////////Shareholding EQUIMETER////////////////////////////////////

// app.get("/shareholding-trend", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const url = `https://www.screener.in/company/${stockName}/consolidated/`;

//   try {
//     const shareholdingData = await scrapeShareData(url);

//     if (!shareholdingData) {
//       return res.status(404).json({ error: "Shareholding data not available" });
//     }

//     const { FIIs, DIIs, Promoters } = shareholdingData;

//     const compareTrend = (arr) => {
//       if (arr.length < 2) return null;
//       const latest = arr[arr.length - 1];
//       const prev = arr[arr.length - 2];
//       return {
//         increased: latest > prev,
//         decreased: latest < prev,
//         same: latest === prev,
//       };
//     };

//     const result = {
//       stockName,
//       Promoters: compareTrend(Promoters),
//       FIIs: compareTrend(FIIs),
//       DIIs: compareTrend(DIIs),
//     };

//     res.json(result);
//   } catch (error) {
//     console.error("Error:", error.message);
//     res.status(500).json({ error: "Server error occurred while scraping" });
//   }
// });

// const scrapeShareData = async (url) => {
//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent": "Mozilla/5.0",
//       },
//     });

//     const $ = cheerio.load(data);
//     const shareholdingSection = $("h2:contains('Shareholding Pattern')")
//       .nextAll("table")
//       .first();

//     if (!shareholdingSection || shareholdingSection.length === 0) {
//       console.error("Shareholding table not found");
//       return null;
//     }

//     const headers = [];
//     shareholdingSection.find("thead tr th").each((i, el) => {
//       headers.push($(el).text().trim());
//     });

//     const fiis = [];
//     const diis = [];
//     const promoters = [];

//     shareholdingSection.find("tbody tr").each((i, row) => {
//       const cells = $(row).find("td");
//       const label = $(cells[0]).text().trim();
//       const values = [];
//       $(cells).each((j, cell) => {
//         if (j === 0) return; // skip label
//         const value = parseFloat($(cell).text().replace("%", "").trim());
//         if (!isNaN(value)) values.push(value);
//       });

//       if (label.includes("Promoters")) promoters.push(...values);
//       else if (label.includes("FII") || label.includes("Foreign")) fiis.push(...values);
//       else if (label.includes("DII") || label.includes("Mutual")) diis.push(...values);
//     });

//     return {
//       FIIs: fiis.slice(-2), // latest two quarters
//       DIIs: diis.slice(-2),
//       Promoters: promoters.slice(-2),
//     };
//   } catch (err) {
//     console.error("Scraping error:", err.message);
//     return null;
//   }
// };


// ///////////////////////////////////////////////////////SENTIMENTAL ANALYSIS///////////////////////////////////////////////////////////////////

// const NEWS_API_KEY = "f0f4ecf43f4d495f826d8a3a26a897e5";
// const GEMINI_API_KEY = "AIzaSyAYIkBf44OKp00Vb4pD395KfVl4GG_MGFw";
// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// // Sentiment Analysis Function
// async function analyzeSentiment(content) {
//   if (!content) return "Neutral";

//   try {
//     const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

//     const prompt = `
//       What is the sentiment of this news content? 
//       Answer with one word only: Positive, Negative, or Neutral.

//       "${content}"
//     `;

//     const result = await model.generateContent(prompt);
//     return result.response.text().trim();
//   } catch (error) {
//     console.error("❌ Gemini Error:", error.message);
//     return "Neutral";
//   }
// }

// app.get("/sentiment", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) {
//     return res.status(400).json({ error: "symbol is required" });
//   }

//   const today = new Date();
//   const priorDate = new Date(today.setMonth(today.getMonth() - 1));
//   const fromDate = priorDate.toISOString().split("T")[0];

//   const newsUrl = `https://newsapi.org/v2/everything?q=%22${encodeURIComponent(
//     symbol
//   )}%22&from=${fromDate}&sortBy=publishedAt&pageSize=7&language=en&apiKey=${NEWS_API_KEY}`;

//   try {
//     const response = await axios.get(newsUrl);
//     const articles = response.data.articles;

//     const analysis = [];

//     for (const article of articles) {
//       const { content, title, url, publishedAt } = article;
//       if (!content || !title) continue;

//       const sentiment = await analyzeSentiment(content);

//       analysis.push({
//         title,
//         sentiment,
//         url,
//         publishedAt,
//       });
//     }

//     // Summary Count
//     const summary = {
//       Positive: analysis.filter((a) => a.sentiment === "Positive").length,
//       Negative: analysis.filter((a) => a.sentiment === "Negative").length,
//       Neutral: analysis.filter((a) => a.sentiment === "Neutral").length,
//     };

//     res.json({
//       status: "ok",
//       symbol,
//       fromDate,
//       totalResults: analysis.length,
//       summary,
//       analysis,
//     });
//   } catch (error) {
//     console.error("❌ API Error:", error.message);
//     res.status(500).json({ error: "Failed to fetch and analyze news." });
//   }
// });

// ///////////////////////////////////////Market Cap//////////////////////////////////////////////////////

// const scrapeMarketCap = async (url, stockName) => {
//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let marketCap = null;

//     // Find span with label 'Market Cap', then get its sibling span.value
//     $("span.name:contains('Market Cap')").each((_, el) => {
//       const valueSpan = $(el).next("span.value");
//       if (valueSpan.length) {
//         marketCap = valueSpan.text().trim();
//         return false; // Stop loop
//       }
//     });

//     if (!marketCap) return null;
//     return { stockName, marketCap };
//   } catch (error) {
//     console.error("❌ Error fetching Market Cap:", error.message);
//     return null;
//   }
// };

// app.get("/market-cap", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const consolidatedUrl = `https://www.screener.in/company/${stockName}/consolidated/`;
//   const fallbackUrl = `https://www.screener.in/company/${stockName}/`;

//   let result = await scrapeMarketCap(consolidatedUrl, stockName);
//   if (!result) {
//     console.log(`📉 Falling back to overview page for ${stockName}`);
//     result = await scrapeMarketCap(fallbackUrl, stockName);
//   }

//   if (!result) return res.status(404).json({ error: "Market Cap not found" });

//   res.json(result);
// });

// /////////////////////////////////////////////////////////FACE VALUE//////////////////////////////////////////////////////////

// // 🟦 Scraper Utility: Generic Label Fetcher
// const scrapeLabelValue = async (url, label, stockName) => {
//   try {
//     const { data } = await axios.get(url, {
//       headers: {
//         "User-Agent":
//           "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//         "Accept-Language": "en-US,en;q=0.9",
//       },
//     });

//     const $ = cheerio.load(data);
//     let value = null;

//     $(`span.name:contains('${label}')`).each((_, el) => {
//       const valueSpan = $(el).next("span.value");
//       if (valueSpan.length) {
//         value = valueSpan.text().trim();
//         return false;
//       }
//     });

//     if (!value) return null;
//     return { stockName, [label.replace(/\s+/g, "").toLowerCase()]: value };
//   } catch (err) {
//     console.error(`❌ Error scraping ${label}:`, err.message);
//     return null;
//   }
// };

// // 🟨 Route: Market Cap
// app.get("/market-cap", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const urls = [
//     `https://www.screener.in/company/${stockName}/consolidated/`,
//     `https://www.screener.in/company/${stockName}/`,
//   ];

//   let result = null;
//   for (let url of urls) {
//     result = await scrapeLabelValue(url, "Market Cap", stockName);
//     if (result) break;
//   }

//   if (!result) return res.status(404).json({ error: "Market Cap not found" });
//   res.json(result);
// });

// // 🟩 Route: Face Value
// app.get("/face-value", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const urls = [
//     `https://www.screener.in/company/${stockName}/consolidated/`,
//     `https://www.screener.in/company/${stockName}/`,
//   ];

//   let result = null;
//   for (let url of urls) {
//     result = await scrapeLabelValue(url, "Face Value", stockName);
//     if (result) break;
//   }

//   if (!result) return res.status(404).json({ error: "Face Value not found" });
//   res.json(result);
// });

// ///////////////////////////////////////////////////HIGH/LOW//////////////////////////////////////////////////

// // 🟥 Route: High / Low
// app.get("/high-low", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const urls = [
//     `https://www.screener.in/company/${stockName}/consolidated/`,
//     `https://www.screener.in/company/${stockName}/`,
//   ];

//   let result = null;
//   for (let url of urls) {
//     result = await scrapeLabelValue(url, "High / Low", stockName);
//     if (result) break;
//   }

//   if (!result) return res.status(404).json({ error: "High / Low not found" });
//   res.json(result);
// });

// ////////////////////////////////////////////BOOK VALUE//////////////////////////////////////////////////

// // 🟦 Book Value
// app.get("/book-value", async (req, res) => {
//   const { symbol } = req.query;
//   if (!symbol) return res.status(400).json({ error: "Symbol is required" });

//   const stockName = symbol.replace(".NS", "");
//   const urls = [
//     `https://www.screener.in/company/${stockName}/consolidated/`,
//     `https://www.screener.in/company/${stockName}/`,
//   ];

//   let result = null;
//   for (let url of urls) {
//     result = await scrapeLabelValue(url, "Book Value", stockName);
//     if (result) break;
//   }

//   if (!result) return res.status(404).json({ error: "Book Value not found" });
//   res.json(result);
// });