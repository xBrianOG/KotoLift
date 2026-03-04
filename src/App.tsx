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
import { AppShell } from "./components/AppShell";
import { LoginScreen } from "./components/LoginScreen";
import { isLoggedIn, clearAuth, devLogin, isDevMode } from "./services/auth";
import type { TranscriptData } from "./components/TranscriptViewerScreen";
import type { VideoPlayerData } from "./components/VideoPlayerScreen";
import "./types";

type Screen = "home" | "review" | "cards" | "add" | "explain" | "drill" | "settings" | "videoImport" | "transcript" | "videoPlayer";

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [videoPlayerData, setVideoPlayerData] = useState<VideoPlayerData | null>(null);

  useEffect(() => {
    // Auto-login in dev mode
    if (isDevMode() && !isLoggedIn()) {
      devLogin().then(() => setAuthenticated(true)).catch(console.error);
    } else {
      setAuthenticated(isLoggedIn());
    }
    
    const saved = localStorage.getItem('transcript.last');
    if (saved) {
      try {
        setTranscriptData(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const navigate = (to: string) => {
    const valid = ["home", "review", "drill", "cards", "add", "explain", "settings", "videoImport", "transcript", "videoPlayer"] as const;
    if ((valid as any).includes(to)) setScreen(to as Screen);
  };

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    clearAuth();
    setAuthenticated(false);
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

  const handleAuthError = () => {
    handleLogout();
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
    <AppShell current={screen} onNavigate={navigate}>
      {screen === "home" && <HomeScreen onNavigate={navigate} />}
      {screen === "review" && (
        <ReviewScreen
          onExplain={(card) => {
            // Persist some initial sentence for Explain detail flow
            if (card?.jaText) {
              localStorage.setItem("explain.initial", JSON.stringify({ sentence: card.jaText }));
            }
            navigate('explain')
          }}
          onNavigateHome={() => navigate('home')}
        />
      )}
      {screen === "drill" && <DrillScreen />}
      {screen === "cards" && (
        <CardListScreen
          onExplain={(card) => {
            if (card?.jaText) {
              localStorage.setItem("explain.initial", JSON.stringify({ sentence: card.jaText }));
            }
            navigate('explain')
          }}
        />
      )}
      {screen === "add" && <AddCardScreen onSave={() => navigate('cards')} onNavigateToVideoImport={() => navigate('videoImport')} />}
      {screen === "videoImport" && (
        <VideoImportScreen
          onComplete={(count) => {
            navigate('cards');
          }}
          onCancel={() => navigate('add')}
          onViewTranscript={handleViewTranscript}
          onOpenPlayer={handleOpenPlayer}
        />
      )}
      {screen === "transcript" && transcriptData && (
        <TranscriptViewerScreen
          data={transcriptData}
          onBack={() => navigate('videoImport')}
        />
      )}
      {screen === "videoPlayer" && videoPlayerData && (
        <VideoPlayerScreen
          data={videoPlayerData}
          onBack={() => navigate('videoImport')}
        />
      )}
      {screen === "explain" && <ExplainScreen />}
      {screen === "settings" && <SettingsScreen onBack={() => navigate('home')} onSignOut={handleLogout} />}
    </AppShell>
  );
}

export default App;
