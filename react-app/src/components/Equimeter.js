import React, { useEffect, useState } from "react";
import axios from "axios";
import { Radar } from "react-chartjs-2";
import GaugeChart from "react-gauge-chart";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const Equimeter = ({ symbol, stockName }) => {
  const [scores, setScores] = useState({
    tech: 0,
    fundamental: 0,
    shareholding: 0,
    valuation: 0,
    sentiment: 0,
  });

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const baseUrl = "http://localhost:5000";

        // Ensure '.NS' is appended to the symbol
        const formattedSymbol = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;

        const [
          techRes,
          fundamentalRes,
          shareholdingRes,
          pegRes,
          sentimentRes,
        ] = await Promise.all([
          axios.get(`${baseUrl}/tech-score?symbol=${formattedSymbol}`),
          axios.get(`${baseUrl}/fundamental-score?symbol=${formattedSymbol}`),
          axios.get(`${baseUrl}/shareholding-equimeter?symbol=${formattedSymbol}`),
          axios.get(`${baseUrl}/peg-ratio?symbol=${formattedSymbol}`),
          axios.get(`${baseUrl}/sentiment?stockName=${encodeURIComponent(stockName)}`),
        ]);

        // Initialize score data with defaults (0)
        let scoreData = {
          tech: 0,
          fundamental: 0,
          shareholding: 0,
          valuation: 0,
          sentiment: 0,
        };

        // If data exists, assign the scores, otherwise keep default 0
        scoreData.tech = techRes?.data?.scores?.finalScore || 0;
        scoreData.fundamental = fundamentalRes?.data?.totalFundamentalScore || 0;
        scoreData.shareholding = shareholdingRes?.data?.shareholdingScore || 0;
        scoreData.valuation = pegRes?.data?.pegScore || 0; // Valuation Score
        const sentiment = sentimentRes?.data?.summary;

        // Check if sentiment data is available
        if (sentiment && Object.keys(sentiment).length > 0) {
          const sentimentCounts = {
            Positive: sentiment.Positive || 0,
            Neutral: sentiment.Neutral || 0,
            Negative: sentiment.Negative || 0,
          };
          const maxType = Object.entries(sentimentCounts).sort(
            (a, b) => b[1] - a[1]
          )[0][0];

          if (maxType === "Positive") scoreData.sentiment = 20;
          else if (maxType === "Neutral") scoreData.sentiment = 10;
        }

        setScores(scoreData);
      } catch (err) {
        console.error("Error fetching scores:", err.message);

        // In case of an error, default all scores to 0
        setScores({
          tech: 0,
          fundamental: 0,
          shareholding: 0,
          valuation: 0,
          sentiment: 0,
        });
      }
    };

    if (symbol && stockName) fetchScores();
  }, [symbol, stockName]);

  const total =
    scores.tech +
    scores.fundamental +
    scores.shareholding +
    scores.valuation +
    scores.sentiment;

  return (
    <div
      style={{
        width: "70%",  // Increased width for a bigger design
        margin: "0 auto",
        padding: "2.5rem",
        backgroundColor: "#fff",
        borderRadius: "20px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.1)",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          fontSize: "2.5rem",  // Increased header size
          fontWeight: "700",
          marginBottom: "1.5rem",
          color: "#212121",
        }}
      >
        Equimeter
      </h2>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "6rem",  // Increased gap for better spacing
          flexWrap: "wrap",
        }}
      >
        <div style={{ width: "600px", height: "500px" }}>  {/* Increased size for Radar chart */}
          <Radar
            data={{
              labels: [
                "Technical Score",
                "Fundamental Score",
                "Shareholding Score",
                "Valuation Score",  // Updated to Valuation
                "Sentiment Score",
              ],
              datasets: [
                {
                  label: "Score (out of 20)",
                  data: [
                    scores.tech,
                    scores.fundamental,
                    scores.shareholding,
                    scores.valuation,
                    scores.sentiment,
                  ],
                  backgroundColor: "rgba(0, 123, 255, 0.3)",
                  borderColor: "#007bff",
                  borderWidth: 2,
                  pointBackgroundColor: "#fff",
                  pointBorderColor: "#007bff",
                  pointRadius: 6,
                  pointHoverRadius: 8,
                  pointHoverBackgroundColor: "#007bff",
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                r: {
                  beginAtZero: true,
                  max: 20,
                  ticks: { stepSize: 5, color: "#333" },
                  grid: { color: "#ccc" },
                  pointLabels: {
                    color: "#212529",
                    font: { size: 16, weight: "bold" },
                  },
                },
              },
              plugins: {
                legend: { display: false },
              },
            }}
            height={500}  // Increased height for Radar chart
          />
        </div>

        <div style={{ width: "400px", textAlign: "center" }}>
          <GaugeChart
            id="equimeter-gauge"
            nrOfLevels={30}
            arcWidth={0.4}
            colors={["#f44336", "#ff9800", "#4caf50"]}
            percent={parseFloat(total) / 100}
            needleColor="#111"
            textColor="transparent"
          />
          <div
            style={{
              fontSize: "1.5rem",  // Slightly smaller font size for Overall Score
              fontWeight: "700",
              marginTop: "1rem",
              color: "#000",
            }}
          >
            Overall Score: {total.toFixed(2)} / 100
          </div>
        </div>
      </div>
    </div>
  );
};

export default Equimeter;
