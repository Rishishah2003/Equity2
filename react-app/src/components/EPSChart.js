import React, { useEffect, useState } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const EPSChart = ({ symbol }) => {
  const [epsData, setEpsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companyInfo, setCompanyInfo] = useState("");

  useEffect(() => {
    const fetchEpsData = async () => {
      try {
        const adjustedSymbol = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;
        const response = await axios.get(
          `http://localhost:5000/historic-eps?symbol=${adjustedSymbol}`
        );
        setEpsData(response.data.epsHistory || []);
      } catch (err) {
        setError("Failed to fetch EPS data.");
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchEpsData();
    }
  }, [symbol]);

  const calculateYoYChange = (data) => {
    return data.map((value, i) =>
      i === 0 ? null : (((value - data[i - 1]) / data[i - 1]) * 100).toFixed(2)
    );
  };

  const epsYoY = calculateYoYChange(epsData.map((entry) => entry.epsActual));

  const chartData = {
    labels: epsData.map((entry) =>
      new Date(entry.quarter).toLocaleDateString("en-US", { year: "numeric", month: "short" })
    ),
    datasets: [
      {
        label: "EPS (Actual)",
        data: epsData.map((entry) => entry.epsActual),
        fill: true,
        backgroundColor: "rgba(99, 102, 241, 0.2)",
        borderColor: "rgba(99, 102, 241, 1)",
        pointBackgroundColor: "rgba(99, 102, 241, 1)",
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: `EPS History`,
        font: {
          size: 24,
          weight: "bold",
          family: "Arial, sans-serif",
        },
        color: "black",
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem) {
            const index = tooltipItem.dataIndex;
            const value = tooltipItem.raw;
            let lines = [];

            lines.push(`EPS: ₹${value.toFixed(2)} Cr`);
            if (epsYoY[index]) {
              lines.push(`QoQ EPS Change: ${epsYoY[index]}%`);
            }

            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Quarter",
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "EPS (in Crores)",
        },
        grid: {
          display: false,
        },
      },
    },
  };

  // Do not render anything if error, loading or no data
  if (error || loading || epsData.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        width: "45%",
        maxWidth: "900px",
        margin: "20px auto",
        padding: "10px",
        backgroundColor: "#fff",
        borderRadius: "8px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div style={{ marginBottom: "20px", fontSize: "18px", color: "#333" }}>
        {companyInfo}
      </div>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default EPSChart;
