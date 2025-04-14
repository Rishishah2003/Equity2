import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

// Register chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SalesChart = ({ symbol }) => {
  const [sales, setSales] = useState([]);
  const [profit, setProfit] = useState([]);
  const [years, setYears] = useState([]);
  const [error, setError] = useState(null);
  const [companyInfo, setCompanyInfo] = useState("");

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        const symbolWithSuffix = `${symbol}.NS`;
        const response = await fetch(`http://localhost:5000/yfinance/${symbolWithSuffix}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          const reversedYears = data.years.reverse();
          const reversedSales = data.sales.reverse().map((value) => value / 1e7); // Crores
          const reversedProfit = data.profit.reverse().map((value) => value / 1e7); // Crores

          setSales(reversedSales);
          setProfit(reversedProfit);
          setYears(reversedYears);

          setError(null);
        }
      } catch (err) {
        setError("Failed to fetch data from the backend");
      }
    };

    if (symbol) {
      fetchFinancialData();
    }
  }, [symbol]);

  const calculateYoYChange = (data) => {
    return data.map((value, i) =>
      i === 0 ? null : (((value - data[i - 1]) / data[i - 1]) * 100).toFixed(2)
    );
  };

  const salesYoY = calculateYoYChange(sales);
  const profitYoY = calculateYoYChange(profit);

  const calculateProfitToSalesPercentage = (salesValue, profitValue) => {
    return ((profitValue / salesValue) * 100).toFixed(2);
  };

  const chartData = {
    labels: years,
    datasets: [
      {
        label: "Sales (in Crores)",
        data: sales,
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
      {
        label: "Profit (in Crores)",
        data: profit,
        backgroundColor: "rgba(255, 99, 132, 0.6)",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: `Sales & Profit Over the Years`,
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
            const datasetIndex = tooltipItem.datasetIndex;
            const index = tooltipItem.dataIndex;
            const value = tooltipItem.raw;
            let lines = [];

            if (datasetIndex === 0) {
              // Sales Tooltip
              lines.push(`Sales: ₹${value.toFixed(2)} Cr`);
              if (salesYoY[index]) {
                lines.push(`YoY Sales Change: ${salesYoY[index]}%`);
              }
              lines.push(`Profit to Sales: ${calculateProfitToSalesPercentage(sales[index], profit[index])}%`);
            } else if (datasetIndex === 1) {
              // Profit Tooltip
              lines.push(`Profit: ₹${value.toFixed(2)} Cr`);
              if (profitYoY[index]) {
                lines.push(`YoY Profit Change: ${profitYoY[index]}%`);
              }
              lines.push(`Profit to Sales: ${calculateProfitToSalesPercentage(sales[index], profit[index])}%`);
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
          text: "Year",
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Amount in Crores",
        },
        grid: {
          display: false,
        },
      },
    },
  };

  if (error) {
    return <div style={{ color: "red", fontWeight: "bold" }}>{error}</div>;
  }

  if (sales.length === 0 || profit.length === 0 || years.length === 0) {
    return <div>Loading...</div>;
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
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default SalesChart;
