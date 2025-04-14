import React, { useEffect, useState } from "react";

const ProfitMargins = ({ symbol }) => {
  const [profitMargins, setProfitMargins] = useState(null);

  useEffect(() => {
    const fetchProfitMargins = async () => {
      setProfitMargins(null);

      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/financial-data?symbol=${formattedSymbol}`);
        const data = await response.json();

        if (data?.fullData?.profitMargins !== undefined && data.fullData.profitMargins !== null) {
          setProfitMargins(data.fullData.profitMargins);
        }
      } catch (error) {
        // Silent fail
      }
    };

    if (symbol) {
      fetchProfitMargins();
    }
  }, [symbol]);

  if (profitMargins === null) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Profit Margins</div>
      <div style={styles.value}>{(profitMargins * 100).toFixed(2)}%</div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: "#ffffff",
    padding: "25px 16px",
    margin: "10px auto",
    width: "200px",
    borderRadius: "10px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    textAlign: "center",
    fontFamily: "'Segoe UI', sans-serif",
  },
  title: {
    fontSize: "22px",
    fontWeight: "750",
    color: "#333",
    marginBottom: "4px",
  },
  value: {
    fontSize: "22px",
    fontWeight: "650",
    color: "#007bff",
  },
};

export default ProfitMargins;
