import { useState } from "react";
import { ReviewScreen } from "./components/ReviewScreen";
import { CardListScreen } from "./components/CardListScreen";
import { AddCardScreen } from "./components/AddCardScreen";
import { ExplainScreen } from "./components/ExplainScreen";
import { DrillScreen } from "./components/DrillScreen";
import "./types";

type Screen = "review" | "cards" | "add" | "explain" | "drill";

function App() {
  const [screen, setScreen] = useState<Screen>("review");

  return (
    <div className="container">
      <header className="header">
        <h1
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: 0,
          }}
        >
          <img
            src="/kotolift-logo.svg"
            alt="Koto Lift Logo"
            style={{ width: 28, height: 28 }}
          />
          <span>Koto Lift</span>
        </h1>

        <nav className="nav">
          <button
            className={`nav-btn ${screen === "review" ? "active" : ""}`}
            onClick={() => setScreen("review")}
          >
            Review
          </button>

          <button
            className={`nav-btn ${screen === "drill" ? "active" : ""}`}
            onClick={() => setScreen("drill")}
          >
            Drill
          </button>

          <button
            className={`nav-btn ${screen === "cards" ? "active" : ""}`}
            onClick={() => setScreen("cards")}
          >
            Cards
          </button>

          <button
            className={`nav-btn ${screen === "add" ? "active" : ""}`}
            onClick={() => setScreen("add")}
          >
            Add
          </button>

          <button
            className={`nav-btn ${screen === "explain" ? "active" : ""}`}
            onClick={() => setScreen("explain")}
          >
            Explain
          </button>
        </nav>
      </header>

      {screen === "review" && <ReviewScreen />}
      {screen === "drill" && <DrillScreen />}
      {screen === "cards" && <CardListScreen />}
      {screen === "add" && <AddCardScreen onSave={() => setScreen("cards")} />}
      {screen === "explain" && <ExplainScreen />}
    </div>
  );
}

export default App;
