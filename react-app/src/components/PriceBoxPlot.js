import React, { useEffect, useState } from 'react';
import axios from 'axios';

const PriceCard = ({ label, value }) => {
  // Check if the value is a valid number before calling toFixed()
  const formattedValue = value != null && !isNaN(value) ? value.toFixed(2) : 'N/A';

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      padding: '16px', 
      marginBottom: '12px',
      fontSize: '1.25rem',
    }}>
      <span style={{ paddingRight: '10px' }}>{label}</span> {/* Added padding between label and value */}
      <span>₹{formattedValue}</span>
    </div>
  );
};

const RecommendationCard = ({ recommendation, analystsCount }) => {
  const recommendationStyles = {
    Buy: { backgroundColor: '#4CAF50', color: 'white' },
    Sell: { backgroundColor: '#F44336', color: 'white' },
    Neutral: { backgroundColor: '#9E9E9E', color: 'white' },
    Hold: { backgroundColor: '#808080', color: 'white' },
  };

  return (
    <div style={{
      ...recommendationStyles[recommendation] || recommendationStyles.Neutral,
      padding: '16px',
      borderRadius: '8px',
      textAlign: 'center',
      marginBottom: '16px',
      fontSize: '1.5rem',
      fontWeight: 'bold',
    }}>
      <span style={{ paddingRight: '10px' }}>{recommendation} Recommendation</span> 
      <div style={{
        fontSize: '1rem',
        marginTop: '8px',
        color: '#ffffffcc',
        paddingTop: '8px',
      }}>
        Based on {analystsCount} analysts
      </div>
    </div>
  );
};

const PriceBoxPlot = ({ symbol }) => {
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const adjustedSymbol = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;

        const response = await axios.get(`http://localhost:5000/financial-data?symbol=${adjustedSymbol}`);
        setStockData(response.data);
      } catch (err) {
        setError("Failed to fetch stock data.");
      } finally {
        setLoading(false);
      }
    };

    if (symbol) {
      fetchStockData();
    }
  }, [symbol]);

  // If data is missing, loading, or Target Low Price is not available, return null
  if (loading || !stockData || !stockData.fullData || stockData.fullData.targetLowPrice == null) return null;

  const priceTargets = [
    { label: 'Current Price', value: stockData.fullData.currentPrice },
    { label: 'Target Low Price', value: stockData.fullData.targetLowPrice },
    { label: 'Target Mean Price', value: stockData.fullData.targetMeanPrice },
    { label: 'Target Median Price', value: stockData.fullData.targetMedianPrice },
    { label: 'Target High Price', value: stockData.fullData.targetHighPrice },
  ];

  return (
    <div style={{
      maxWidth: '450px', 
      margin: '20px auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    }}>
      <RecommendationCard
        recommendation={stockData.fullData.recommendationKey === 'buy' ? 'Buy' : stockData.fullData.recommendationKey === 'sell' ? 'Sell' : 'Hold'}
        analystsCount={stockData.fullData.numberOfAnalystOpinions}
      />
      {priceTargets.map((target, index) => (
        <PriceCard
          key={index}
          label={target.label}
          value={target.value}
        />
      ))}
    </div>
  );
};

export default PriceBoxPlot;
