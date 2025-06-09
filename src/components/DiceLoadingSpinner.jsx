import React, { useState, useEffect } from 'react';
import '../styles/DiceLoadingSpinner.css';

const DiceLoadingSpinner = () => {
  const [currentNumber, setCurrentNumber] = useState(6);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNumber(Math.floor(Math.random() * 6) + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getDots = (number) => {
    switch (number) {
      case 1:
        return <span className="dot center"></span>;
      case 2:
        return (
          <>
            <span className="dot top-right"></span>
            <span className="dot bottom-left"></span>
          </>
        );
      case 3:
        return (
          <>
            <span className="dot top-right"></span>
            <span className="dot center"></span>
            <span className="dot bottom-left"></span>
          </>
        );
      case 4:
        return (
          <>
            <span className="dot top-left"></span>
            <span className="dot top-right"></span>
            <span className="dot bottom-left"></span>
            <span className="dot bottom-right"></span>
          </>
        );
      case 5:
        return (
          <>
            <span className="dot top-left"></span>
            <span className="dot top-right"></span>
            <span className="dot center"></span>
            <span className="dot bottom-left"></span>
            <span className="dot bottom-right"></span>
          </>
        );
      case 6:
      default:
        return (
          <>
            <span className="dot top-left"></span>
            <span className="dot top-right"></span>
            <span className="dot middle-left"></span>
            <span className="dot middle-right"></span>
            <span className="dot bottom-left"></span>
            <span className="dot bottom-right"></span>
          </>
        );
    }
  };

  return (
    <div className="dice-loading-overlay">
      <div className="dice">
        <div className="face front">{getDots(currentNumber)}</div>
        <div className="face back">{getDots(Math.ceil(Math.random() * 6))}</div>
        <div className="face right">{getDots(Math.ceil(Math.random() * 6))}</div>
        <div className="face left">{getDots(Math.ceil(Math.random() * 6))}</div>
        <div className="face top">{getDots(Math.ceil(Math.random() * 6))}</div>
        <div className="face bottom">{getDots(Math.ceil(Math.random() * 6))}</div>
      </div>
    </div>
  );
};

export default DiceLoadingSpinner; 