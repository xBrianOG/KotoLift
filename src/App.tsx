import { useState, useEffect } from "react";
import { ReviewScreen } from "./components/ReviewScreen";
import { CardListScreen } from "./components/CardListScreen";
import { AddCardScreen } from "./components/AddCardScreen";
import { ExplainScreen } from "./components/ExplainScreen";
import { DrillScreen } from "./components/DrillScreen";
import { HomeScreen } from "./components/HomeScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { VideoImportScreen } from "./components/VideoImportScreen";
import { TranscriptViewerScreen } from "./components/TranscriptViewerScreen";
import { VideoPlayerScreen } from "./components/VideoPlayerScreen";
import { LanguagePicker } from "./components/LanguagePicker";
import { AppShell } from "./components/AppShell";
import { LoginScreen } from "./components/LoginScreen";
import { LessonsScreen } from "./components/LessonsScreen";
import { VocabularyScreen } from "./components/VocabularyScreen";
import { AssessmentScreen } from "./components/AssessmentScreen";
import { isLoggedIn, clearAuth, devLogin, isDevMode } from "./services/auth";
import { initSettings } from "./services/settings";
import type { Card } from "./types";
import type { TranscriptData } from "./components/TranscriptViewerScreen";
import type { VideoPlayerData } from "./components/VideoPlayerScreen";
import "./types";

type Screen = "home" | "review" | "cards" | "add" | "explain" | "drill" | "settings" | "videoImport" | "transcript" | "videoPlayer" | "lessons" | "vocabulary" | "assessment";

function App() {
  const [history, setHistory] = useState<Screen[]>(["home"]);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [videoPlayerData, setVideoPlayerData] = useState<VideoPlayerData | null>(null);
  const [pendingExplainCard, setPendingExplainCard] = useState<Card | null>(null);

  const screen = history[history.length - 1];

  useEffect(() => {
    // Prime Dexie settings cache on startup
    initSettings().catch(console.error);
    // Auth check
    if (isDevMode() && !isLoggedIn()) {
      devLogin().then(() => setAuthenticated(true)).catch(console.error);
    } else {
      setAuthenticated(isLoggedIn());
    }

    const saved = localStorage.getItem('transcript.last');
    if (saved) {
      try {
        setTranscriptData(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const navigate = (to: string) => {
    const valid = ["home", "review", "drill", "cards", "add", "explain", "settings", "videoImport", "transcript", "videoPlayer", "lessons", "vocabulary", "assessment"] as const;
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

  const handleViewTranscript = (data: TranscriptData) => {
    setTranscriptData(data);
    localStorage.setItem('transcript.last', JSON.stringify(data));
    navigate('transcript');
  };

  const handleOpenPlayer = (data: VideoPlayerData) => {
    setVideoPlayerData(data);
    navigate('videoPlayer');
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
    <AppShell current={screen} onNavigate={navigate} onBack={history.length > 1 ? goBack : undefined}>
      {screen === "home" && <HomeScreen onNavigate={navigate} />}
      {screen === "review" && (
        <ReviewScreen
          onExplain={handleExplainCard}
          onNavigateHome={() => setHistory(["home"])}
        />
      )}
      {screen === "drill" && <DrillScreen />}
      {screen === "cards" && (
        <CardListScreen
          onExplain={handleExplainCard}
        />
      )}
      {screen === "add" && <AddCardScreen onSave={() => navigate('cards')} onNavigateToVideoImport={() => navigate('videoImport')} />}
      {screen === "videoImport" && (
        <VideoImportScreen
          onComplete={() => { navigate('cards'); }}
          onCancel={goBack}
          onViewTranscript={handleViewTranscript}
          onOpenPlayer={handleOpenPlayer}
        />
      )}
      {screen === "transcript" && transcriptData && (
        <TranscriptViewerScreen
          data={transcriptData}
          onBack={goBack}
        />
      )}
      {screen === "videoPlayer" && videoPlayerData && (
        <VideoPlayerScreen
          data={videoPlayerData}
          onBack={goBack}
        />
      )}
      {screen === "explain" && <ExplainScreen />}
      {screen === "settings" && <SettingsScreen onBack={goBack} onSignOut={handleLogout} />}
      {screen === "lessons" && <LessonsScreen onBack={goBack} />}
      {screen === "vocabulary" && <VocabularyScreen onBack={goBack} />}
      {screen === "assessment" && <AssessmentScreen onBack={goBack} />}

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
