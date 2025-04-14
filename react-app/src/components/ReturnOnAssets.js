import React, { useEffect, useState } from "react";

const ReturnOnAssets = ({ symbol }) => {
  const [returnOnAssets, setReturnOnAssets] = useState(null);

  useEffect(() => {
    const fetchReturnOnAssets = async () => {
      setReturnOnAssets(null);

      // Ensure the symbol ends with ".NS"
      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/financial-data?symbol=${formattedSymbol}`);
        const data = await response.json();

        if (data?.fullData?.returnOnAssets !== undefined && data.fullData.returnOnAssets !== null) {
          setReturnOnAssets(data.fullData.returnOnAssets);
        }
      } catch (error) {
        // Silent fail
      }
    };

    if (symbol) {
      fetchReturnOnAssets();
    }
  }, [symbol]);

  if (returnOnAssets === null) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Return on Assets</div>
      <div style={styles.value}>{(returnOnAssets * 100).toFixed(2)}%</div>
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

export default ReturnOnAssets;
