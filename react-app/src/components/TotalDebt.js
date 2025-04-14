import React, { useEffect, useState } from "react";

const TotalDebt = ({ symbol }) => {
  const [totalDebt, setTotalDebt] = useState(null);

  useEffect(() => {
    const fetchTotalDebt = async () => {
      setTotalDebt(null);

      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/financial-data?symbol=${formattedSymbol}`);
        const data = await response.json();

        if (data?.fullData?.totalDebt !== undefined && data.fullData.totalDebt !== null) {
          setTotalDebt(data.fullData.totalDebt);
        }
      } catch (error) {
        // Silent fail
      }
    };

    if (symbol) {
      fetchTotalDebt();
    }
  }, [symbol]);

  if (totalDebt === null) return null;

  const formatInCrores = (value) => {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  };

  return (
    <div style={styles.card}>
      <div style={styles.title}>Total Debt</div>
      <div style={styles.value}>{formatInCrores(totalDebt)}</div>
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

export default TotalDebt;
