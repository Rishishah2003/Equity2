import React, { useEffect, useState } from "react";

const QuickRatio = ({ symbol }) => {
  const [quickRatio, setQuickRatio] = useState(null);

  useEffect(() => {
    const fetchQuickRatio = async () => {
      setQuickRatio(null);

      // Ensure symbol ends with ".NS"
      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/financial-data?symbol=${formattedSymbol}`);
        const data = await response.json();

        if (data?.fullData?.quickRatio !== undefined && data.fullData.quickRatio !== null) {
          setQuickRatio(data.fullData.quickRatio);
        }
      } catch (error) {
        // Fail silently
      }
    };

    if (symbol) {
      fetchQuickRatio();
    }
  }, [symbol]);

  if (quickRatio === null) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Quick Ratio</div>
      <div style={styles.value}>{quickRatio}</div>
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

export default QuickRatio;
