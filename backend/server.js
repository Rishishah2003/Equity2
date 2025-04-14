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

//////////////////////////////////////////////API FINBOT SEND QUESTION/////////////////////////////////////////////////////////////

app.get("/ask", (req, res) => {
  const userQuestion = req.query.question;

  if (userQuestion) {
    console.log(`User asked: ${userQuestion}`);
    res.status(200).json({ status: "Received" });
  } else {
    res.status(400).json({ status: "No question received" });
  }
});

///////////////////////////////////////////