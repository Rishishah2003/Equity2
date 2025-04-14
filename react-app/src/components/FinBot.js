import React, { useState, useEffect, useRef } from "react";
import { FiMessageSquare, FiX, FiSend } from "react-icons/fi";

const FinBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        { sender: "bot", text: "Hi! I’m FinBot, your Nifty 50 Assistant. Ask me anything about stocks or indices." }
      ]);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (inputValue.trim() === "") return;

    const userMessage = { sender: "user", text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    try {
      // Encode the question to prevent issues with special characters
      const encodedQuestion = encodeURIComponent(inputValue);

      // Send GET request to the backend with the question as a query parameter
      const response = await fetch(`http://localhost:5001/ask?question=${encodedQuestion}`, {
        method: "GET",
      });

      const data = await response.json();

      if (data.status === "Received") {
        setMessages((prev) => [...prev, { sender: "bot", text: "Your question has been received." }]);
      } else {
        setMessages((prev) => [...prev, { sender: "bot", text: "Sorry, I couldn’t process your question." }]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `Server error: ${error.message}` }
      ]);
    }
  };

  return (
    <>
      <div className="chatbot-button" onClick={toggleChat}>
        {isOpen ? <FiX size={30} /> : <FiMessageSquare size={30} />}
      </div>

      {isOpen && (
        <div className="chatbot-popup">
          <div className="chatbot-header">
            <span>FinBot</span>
            <FiX className="close-icon" size={20} onClick={toggleChat} />
          </div>

          <div className="chatbot-body">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`chat-message ${msg.sender === "user" ? "user" : "bot"}`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="input-wrapper">
            <textarea
              className="chatbot-textarea"
              rows={2}
              placeholder="Ask FinBot about Nifty 50 stocks..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <FiSend className="send-icon" size={22} onClick={handleSend} />
          </div>
        </div>
      )}

      <style jsx>{`
        .chatbot-button {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background-color: #005eff;
          color: white;
          border-radius: 50%;
          padding: 14px;
          cursor: pointer;
          z-index: 1000;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .chatbot-popup {
          position: fixed;
          bottom: 90px;
          right: 24px;
          width: 400px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          z-index: 1000;
        }

        .chatbot-header {
          background-color: #005eff;
          color: white;
          padding: 14px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          font-size: 17px;
        }

        .chatbot-body {
          padding: 14px;
          flex: 1;
          overflow-y: auto;
          max-height: 400px;
          background: #f9f9f9;
          font-size: 15px;
        }

        .chat-message {
          margin-bottom: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          max-width: 90%;
          line-height: 1.5;
        }

        .chat-message.user {
          background-color: #e0e0e0;
          align-self: flex-end;
          text-align: right;
          margin-left: auto;
        }

        .chat-message.bot {
          background-color: #d6e4ff;
          align-self: flex-start;
          text-align: left;
          margin-right: auto;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          border-top: 1px solid #ddd;
          padding: 10px;
          background: white;
        }

        .chatbot-textarea {
          flex: 1;
          resize: none;
          border: none;
          outline: none;
          padding: 10px;
          font-size: 15px;
          border-radius: 10px;
          background: #f1f1f1;
        }

        .send-icon {
          color: #005eff;
          margin-left: 10px;
          cursor: pointer;
        }

        .close-icon {
          cursor: pointer;
        }
      `}</style>
    </>
  );
};

export default FinBot;
