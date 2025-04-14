import React, { useEffect, useState } from "react";

const BookValue = ({ symbol }) => {
  const [bookValue, setBookValue] = useState(null);

  useEffect(() => {
    const fetchBookValue = async () => {
      setBookValue(null);
      const formattedSymbol = symbol?.endsWith(".NS") ? symbol : `${symbol}.NS`;

      try {
        const response = await fetch(`http://localhost:5000/key-statistics?symbol=${formattedSymbol}`);
        const data = await response.json();
        if (data?.bookValue !== undefined && data.bookValue !== null) {
          setBookValue(data.bookValue);
        }
      } catch (error) {}
    };

    if (symbol) fetchBookValue();
  }, [symbol]);

  if (bookValue === null) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Book Value</div>
      <div style={styles.value}>₹{bookValue.toFixed(2)}</div>
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
    color: "#dc3545",
  },
};

export default BookValue;
