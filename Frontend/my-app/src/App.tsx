import { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import Login from './components/Login';
import { usePyodide } from './experiment/usePyodide';
import { useCooldown } from './hooks/useCooldown';
import './App.css';

const EditorPage: React.FC<{ code: string; setCode: (value: string) => void; isAdmin: boolean; userId: string; }> = ({ code, setCode, isAdmin, userId }) => {
  const { isLoading, output, runCode } = usePyodide();
  const cooldownTimeLeft = useCooldown();
  const [pasteWarning, setPasteWarning] = useState('');

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        const startRandRemoveSign = (window as any).startRandRemoveSign;
        if (startRandRemoveSign && !isAdmin) {
          startRandRemoveSign();
          console.log("!Rand remove sign logic started!");
        } else if (isAdmin) {
          console.log("Admin logged in - corruption logic disabled.");
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAdmin]);

  const handlePasteDetected = () => {
    setPasteWarning('Dlaczego wklejasz gotowy tekst? Napisz go samodzielnie!');
    setTimeout(() => setPasteWarning(''), 5000);
  };

  const handleRun = async () => {
    if (cooldownTimeLeft > 0) {
      alert(`Cooldown: czekaj ${cooldownTimeLeft}s`);
      return;
    }

    try {
      const response = await fetch('/api/check-cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Backend check failed');
      }

      const data = await response.json();
      if (!data.allowed) {
        const remaining = data.timeRemaining || cooldownTimeLeft;
        alert(`Backend odrzucił: czekaj ${remaining}s`);
        return;
      }

      runCode(code);
    } catch (err) {
      console.error('Backend check failed:', err);
      runCode(code); // Fallback when backend is unavailable
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      <header style={{ padding: '10px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Python Web IDE {isAdmin ? '(admin)' : ''}</h2>
          {pasteWarning && <p style={{ color: '#ff9800', margin: '5px 0 0 0', fontSize: '12px' }}>{pasteWarning}</p>}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {cooldownTimeLeft > 0 && (
            <div style={{ color: '#ff9800', fontSize: '14px', fontWeight: 'bold' }}>
            {cooldownTimeLeft}s
            </div>
          )}
          <button
            onClick={handleRun}
            disabled={isLoading || cooldownTimeLeft > 0}
            style={{
              backgroundColor: cooldownTimeLeft > 0 ? '#ff6b6b' : (isLoading ? '#555' : '#4CAF50'),
              color: 'white',
              padding: '8px 20px',
              cursor: cooldownTimeLeft > 0 || isLoading ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            {cooldownTimeLeft > 0 ? `Run (${cooldownTimeLeft}s)` : isLoading ? 'Loading Python...' : 'Run'}
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, borderRight: '1px solid #333' }}>
          <CodeEditor value={code} onChange={setCode} onPasteDetected={handlePasteDetected} />
        </div>

        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#000', fontFamily: 'monospace' }}>
          <h4 style={{ marginTop: 0, color: '#888' }}>Console output:</h4>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
        </div>
      </main>
    </div>
  );
};

function App() {
  const [code, setCode] = useState<string>('# Napisz swój kod w Pythonie\nprint("Witaj świecie!")');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState('');

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(userCode, admin) => {
          setUserId(userCode);
          setIsAuthenticated(true);
          setIsAdmin(admin);
          console.log(`Zalogowano użytkownika ${userCode} (admin: ${admin})`);
        }}
      />
    );
  }

  return <EditorPage code={code} setCode={setCode} isAdmin={isAdmin} userId={userId} />;
}

export default App;