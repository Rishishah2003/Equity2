import React, { useEffect, useState } from "react";

const CurrentRatio = ({ symbol }) => {
  const [currentRatio, setCurrentRatio] = useState(null);

  useEffect(() => {
    const fetchCurrentRatio = async () => {
      setCurrentRatio(null);

      // Ensure symbol ends with ".NS"
      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/financial-data?symbol=${formattedSymbol}`);
        const data = await response.json();

        if (data?.fullData?.currentRatio !== undefined && data.fullData.currentRatio !== null) {
          setCurrentRatio(data.fullData.currentRatio);
        }
      } catch (error) {
        // Silent fail
      }
    };

    if (symbol) {
      fetchCurrentRatio();
    }
  }, [symbol]);

  if (currentRatio === null) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Current Ratio</div>
      <div style={styles.value}>{currentRatio}</div>
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

export default CurrentRatio;
