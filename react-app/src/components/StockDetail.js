import React, { useEffect, useState, useRef } from "react"; // Added useRef import
import { useParams } from "react-router-dom";
import StockInfo from "./StockInfo";
import StockPriceChart from "./StockPriceChart";
import SalesChart from "./SalesChart";
import BorrowInvest from "./BorrowInvest";
import ShareholdingChange from "./ShareholdingChange";
import HistoricalPE from "./HistoricalPE";
import DPSChart from "./DPSChart";
import SearchBarTop from "./SearchBarTop";
import Equimeter from "./Equimeter";
import News from "./News";
import PriceToBook from "./PriceToBook";
import PERatio from "./PERatio";
import MarketCap from "./MarketCap";
import FaceValue from "./FaceValue";
import HighLow52Week from "./HighLow52Week";
import BookValue from "./BookValue";
import EPSChart from "./EPSChart";
import QuickRatio from "./QuickRatio";
import CurrentRatio from "./CurrentRatio";
import ReturnOnAssets from "./ReturnOnAssets";
import ReturnOnEquity from "./ReturnOnEquity";
import OperatingMargins from "./OperatingMargins";
import TotalDebt from "./TotalDebt";
import ProfitMargins from "./ProfitMargins";
import ShareholdingPieChart from "./ShareholdingPieChart";
import Beta from "./Beta";
import PriceBoxPlot from "./PriceBoxPlot";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import FinBot from "./FinBot";

const StockDetail = () => {
  const { name } = useParams();
  const [symbol, setSymbol] = useState(null);

  const section1Ref = useRef();
  const section2Ref = useRef();
  const section3Ref = useRef();
  const section4Ref = useRef();

  useEffect(() => {
    const fetchStockSymbol = async () => {
      try {
        const res = await fetch(`http://localhost:5000/get-stock-symbol?stockName=${name}`);
        const data = await res.json();
        if (data.symbol) setSymbol(data.symbol);
        else console.error("Stock symbol not found");
      } catch (error) {
        console.error("Error fetching stock symbol:", error);
      }
    };

    if (name) fetchStockSymbol();
  }, [name]);

  const generateCanvas = async (sectionRef) => {
    return html2canvas(sectionRef.current, { scale: 2 });
  };

  const addCanvasToPDF = (canvas, addNewPage = false, pdf, pageWidth, pageHeight) => {
    const imgData = canvas.toDataURL("image/png");
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pageWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;

    if (addNewPage) pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  };

  const handleDownloadPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Section 1: Stock Info and Price Chart
    const canvas1 = await generateCanvas(section1Ref);
    addCanvasToPDF(canvas1, false, pdf, pageWidth, pageHeight); // Page 1

    // Section 2: Fundamental Factors
    const canvas2 = await generateCanvas(section2Ref);
    addCanvasToPDF(canvas2, true, pdf, pageWidth, pageHeight); // Page 2

    // Section 3: Valuation Factors
    const canvas3 = await generateCanvas(section3Ref);
    addCanvasToPDF(canvas3, true, pdf, pageWidth, pageHeight); // Page 3

    pdf.save(`StockDetail_${name}.pdf`);
  };

  if (!symbol) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div>
      <div style={styles.searchBarWrapper}>
        <SearchBarTop />
      </div>
      <div style={styles.container}>
        {/* Page 1: Stock Info, Price Chart, and Fundamental Factors */}
        <div ref={section1Ref}>
          <StockInfo stockName={name} />
          <StockPriceChart symbol={symbol} />
          
          {/* Fundamental Factors */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>📊 Fundamental Factors</h2>
            <div style={styles.sideBySide}>
              <ProfitMargins symbol={symbol} />
              <TotalDebt symbol={symbol} />
              <OperatingMargins symbol={symbol} />
            </div>
            <div style={styles.sideBySide}>
              <QuickRatio symbol={symbol} />
              <CurrentRatio symbol={symbol} />
              <ReturnOnAssets symbol={symbol} />
              <ReturnOnEquity symbol={symbol} />
            </div>
            <div style={styles.sideBySideCharts}>
              <SalesChart symbol={symbol} />
              <EPSChart symbol={symbol} />
            </div>
          </div>
        </div>

        {/* Page 2: Valuation Factors and Page 4 Contents */}
        <div ref={section2Ref} >
          <div style={styles.card}>
          <h2 style={styles.sectionTitle}>📊 Valuation Factors</h2>
          <div style={styles.sideBySide2}>
            <Beta symbol={symbol} />
            <PriceToBook symbol={symbol} />
            <BookValue symbol={symbol} />
          </div>
          <HistoricalPE symbol={symbol} />
          </div>
          
          {/* Page 4 Contents (Shareholding Pie Chart and Price Box Plot) */}
          <div style={styles.sideBySideCharts2}>
            <ShareholdingPieChart symbol={symbol} />
            <PriceBoxPlot symbol={symbol} />
          </div>

        </div>

        {/* Page 3: Equimeter and News */}
        <div ref={section3Ref} style={styles.cardnewsWrapper}>
          <Equimeter symbol={symbol} stockName={name} style={styles.cardnews} />
          <News symbol={name} style={styles.cardnews} />
        </div>

        {/* Download PDF Button - At the Bottom */}
        <div style={styles.downloadBtnWrapper}>
          <button onClick={handleDownloadPDF} style={styles.downloadBtn}>📥 Download PDF</button>
        </div>
      </div>
      <FinBot></FinBot>
    </div>
  );
};

const styles = {
  searchBarWrapper: {
    padding: "20px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #eee",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
    position: "sticky",
    top: 0,
    zIndex: 999,
  },
  container: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "20px",
    padding: "20px",
    backgroundColor: "#f7f7f7",
    justifyContent: "center",
    minHeight: "100vh", // Ensure container takes full height
  },
  sideBySide: {
    display: "flex",
    justifyContent: "space-between",
    width: "90%",
    margin: "0 auto",
    gap: "20px",
    flexWrap: "wrap",
  },
  sideBySide2: {
    display: "flex",
    justifyContent: "space-between",
    width: "60%",
    margin: "0 auto",
    gap: "20px",
    flexWrap: "wrap",
  },
  sideBySideCharts: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    margin: "0 auto",
    gap: "20px",
    flexWrap: "wrap",
  },
  sideBySideCharts2: {
    display: "flex",
    justifyContent: "space-between",
    width: "70%",
    margin: "0 auto",
    gap: "20px",
    flexWrap: "wrap",
  },
  card: {
    flex: 1,
    padding: "20px",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    margin: "auto",
    width: "1300px",
  },
  cardnews: {
    flex: 1,
    padding: "20px",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    margin: "auto",
    width: "2000px",
  },
  loading: {
    textAlign: "center",
    fontSize: "18px",
    fontWeight: "bold",
    marginTop: "20px",
  },
  sectionTitle: {
    textAlign: "center",
    fontSize: "36px",
    fontWeight: "800",
    marginBottom: "20px",
    color: "#1a1a1a",
    letterSpacing: "1px",
  },
  downloadBtnWrapper: {
    display: "flex",
    justifyContent: "center",
    marginTop: "10px",
    marginBottom: "20px", // Optional, to give some space before bottom
  },
  downloadBtn: {
    backgroundColor: "#4CAF50",
    color: "#fff",
    padding: "15px 30px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
  },
};

export default StockDetail;
