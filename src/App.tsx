import { useState, useEffect } from "react";
import { ReviewScreen } from "./components/ReviewScreen";
import { CardListScreen } from "./components/CardListScreen";
import { AddCardScreen } from "./components/AddCardScreen";
import { ExplainScreen } from "./components/ExplainScreen";
import { DrillScreen } from "./components/DrillScreen";
import { HomeScreen } from "./components/HomeScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { LanguagePicker } from "./components/LanguagePicker";
import { AppShell } from "./components/AppShell";
import { LoginScreen } from "./components/LoginScreen";
import { LessonsScreen } from "./components/LessonsScreen";
import { VocabularyScreen } from "./components/VocabularyScreen";
import { AssessmentScreen } from "./components/AssessmentScreen";
import { DeckListScreen } from "./components/DeckListScreen";
import { DeckCardsScreen } from "./components/DeckCardsScreen";
import { ImportScreen } from "./components/ImportScreen";
import { isLoggedIn, clearAuth, devLogin, isDevMode, getStoredUser } from "./services/auth";
import { initSettings, type LearningSettings } from "./services/settings";
import type { Card, Deck } from "./types";
import "./types";

type Screen = "home" | "review" | "cards" | "add" | "explain" | "drill" | "settings" | "profile" | "videoImport" | "transcript" | "videoPlayer" | "lessons" | "vocabulary" | "assessment" | "deckList" | "deckCards" | "import" | "videoLearning";
const DISABLED_VIDEO_SCREENS = new Set<string>(["videoImport", "videoPlayer", "videoLearning", "transcript"]);

function isDisabledVideoScreen(screen: string): boolean {
  return DISABLED_VIDEO_SCREENS.has(screen);
}

function App() {
  const [history, setHistory] = useState<Screen[]>(["home"]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pendingExplainCard, setPendingExplainCard] = useState<Card | null>(null);
  const [settings, setSettings] = useState<LearningSettings | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [deckCards, setDeckCards] = useState<Card[]>([]);

  const rawScreen = history[history.length - 1];
  const screen = isDisabledVideoScreen(rawScreen) ? "home" : rawScreen;

  useEffect(() => {
    // Prime Dexie settings cache on startup
    initSettings().then(s => {
      setSettings(s);
    }).catch(console.error);
    // Auth check
    if (isDevMode() && !isLoggedIn()) {
      devLogin().then(() => setAuthenticated(true)).catch(console.error);
    } else {
      setAuthenticated(isLoggedIn());
    }
  }, []);

  useEffect(() => {
    if (isDisabledVideoScreen(rawScreen)) {
      setHistory(["home"]);
    }
  }, [rawScreen]);

  const navigate = (to: string) => {
    if (isDisabledVideoScreen(to)) return;
    const valid = ["home", "review", "drill", "cards", "add", "explain", "settings", "profile", "videoImport", "transcript", "videoPlayer", "lessons", "vocabulary", "assessment", "deckList", "deckCards", "import", "videoLearning"] as const;
    if ((valid as readonly string[]).includes(to)) {
      setHistory(h => [...h, to as Screen]);
    }
  };

  const goBack = () => {
    setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));
  };

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuth();
    setAuthenticated(false);
    setHistory(["home"]);
  };

  const handleExplainCard = (card: Card) => {
    setPendingExplainCard(card);
  };

  const handleExplainSelect = (sentence: string, lang: string) => {
    localStorage.setItem("explain.initial", JSON.stringify({ sentence, lang }));
    setPendingExplainCard(null);
    navigate('explain');
  };

  if (authenticated === null) {
    return (
      <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <AppShell 
        current={screen} 
        onNavigate={navigate} 
        onBack={history.length > 1 ? goBack : undefined}
        settings={settings}
        userName={getStoredUser()?.name || 'User'}
      >
      {screen === "home" && <HomeScreen onNavigate={navigate} />}
      {screen === "review" && (
        <ReviewScreen
          onExplain={handleExplainCard}
          onNavigateHome={() => setHistory(["home"])}
        />
      )}
      {screen === "drill" && <DrillScreen cards={deckCards.length > 0 ? deckCards : undefined} />}
      {screen === "cards" && (
        <CardListScreen
          onExplain={handleExplainCard}
        />
      )}
      {screen === "add" && <AddCardScreen onSave={() => navigate('cards')} />}
      {screen === "explain" && <ExplainScreen />}
      {screen === "settings" && <SettingsScreen settings={settings} onBack={goBack} onSignOut={handleLogout} userName={getStoredUser()?.name} />}
      {screen === "profile" && <ProfileScreen onBack={goBack} />}
      {screen === "lessons" && <LessonsScreen onBack={goBack} onNavigate={navigate} />}
      {screen === "vocabulary" && <VocabularyScreen onBack={goBack} />}
      {screen === "assessment" && <AssessmentScreen onBack={goBack} />}
      {screen === "deckList" && (
        <DeckListScreen 
          onBack={goBack} 
          onSelectDeck={(deck) => {
            setSelectedDeck(deck);
            navigate('deckCards');
          }}
          onImport={() => navigate('import')}
        />
      )}
      {screen === "import" && (
        <ImportScreen 
          onBack={goBack}
          onComplete={() => goBack()}
        />
      )}
      {screen === "deckCards" && selectedDeck && (
        <DeckCardsScreen
          deck={selectedDeck}
          onBack={goBack}
          onReview={(cards) => {
            setDeckCards(cards);
            navigate('drill');
          }}
        />
      )}

      {pendingExplainCard && (
        <LanguagePicker
          card={pendingExplainCard}
          onSelect={handleExplainSelect}
          onClose={() => setPendingExplainCard(null)}
        />
      )}
    </AppShell>
  );
}

export default App;
