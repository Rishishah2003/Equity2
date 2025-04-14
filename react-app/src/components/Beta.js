import React, { useEffect, useState } from "react";

const Beta = ({ symbol }) => {
  const [beta, setBeta] = useState(null);

  useEffect(() => {
    const fetchBeta = async () => {
      setBeta(null);
      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/key-statistics?symbol=${formattedSymbol}`);
        const data = await response.json();
        if (data?.beta !== undefined && data.beta !== null) {
          setBeta(data.beta);
        }
      } catch (error) {}
    };

    if (symbol) fetchBeta();
  }, [symbol]);

  if (beta === null) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Beta</div>
      <div style={styles.value}>{beta.toFixed(2)}</div>
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
    color: "#6f42c1",
  },
};

export default Beta;
