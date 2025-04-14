import React, { useEffect, useState } from "react";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// Register required components from Chart.js
ChartJS.register(ArcElement, Tooltip, Legend);

const ShareholdingPieChart = ({ symbol }) => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    // Ensure the symbol has ".NS" at the end
    const formattedSymbol = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;

    // Fetch shareholding data from the server
    const fetchShareholdingData = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/shareholding-data?symbol=${formattedSymbol}`);
        const { heldPercentInstitutions, heldPercentInsiders } = res.data;

        // Default to 0 if data is unavailable
        const institutionalInvestors = (heldPercentInstitutions || 0) * 100; // Convert to percentage
        const promoters = (heldPercentInsiders || 0) * 100; // Convert to percentage
        const publicInvestors = 100 - institutionalInvestors - promoters;

        setChartData({
          labels: ["Institutional Investors", "Promoters", "Public"],
          datasets: [
            {
              data: [institutionalInvestors, promoters, publicInvestors],
              backgroundColor: ["#FF7F50", "#FFD700", "#FF69B4"], // Orange, Yellow, Pink
              hoverBackgroundColor: ["#FF6347", "#FFFF00", "#FF1493"], // Lively hover colors
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching shareholding data:", error);
      }
    };

    if (formattedSymbol) {
      fetchShareholdingData();
    }
  }, [symbol]);

  if (!chartData) {
    return <div>Loading...</div>;
  }

  return (
    <div style={styles.chartContainer}>
      <h2 style={styles.sectionTitle}>Current Shareholding</h2>
      <div style={styles.pieChart}>
        <Pie data={chartData} options={options} />
      </div>
    </div>
  );
};

// Options for the Pie chart
const options = {
  responsive: true,
  plugins: {
    legend: {
      position: "top",
    },
    tooltip: {
      callbacks: {
        label: function (tooltipItem) {
          const value = tooltipItem.raw;
          return `${tooltipItem.label}: ${value.toFixed(2)}%`; // Display the value with 2 decimal places
        },
      },
    },
  },
  maintainAspectRatio: false, // To control the size
};

const styles = {
  chartContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",  // Center the chart horizontally
    alignItems: "center",  // Center the chart vertically
    width: "500px",  // Adjust width to fit the chart
    margin: "20px auto",  // Center the container
    padding: "20px",
    textAlign: "center",
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    height: "440px",  // Adjust height for better visibility
  },
  pieChart: {
    width: "100%",  // Full width for the pie chart
    height: "300px",  // Fixed height for the chart
  },
  sectionTitle: {
    textAlign: "center",
    fontSize: "36px",
    fontWeight: "800",
    marginBottom: "20px",
    color: "#1a1a1a",
    letterSpacing: "1px",
  },
};

export default ShareholdingPieChart;
