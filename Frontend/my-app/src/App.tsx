import { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import { usePyodide } from './experiment/usePyodide';
import './App.css';

function App() {
  const [code, setCode] = useState<string>('# Napisz swój kod w Pythonie\nprint("Witaj świecie!")');

  // Initialization of Pyodide engine
  const { isLoading, output, runCode } = usePyodide();

  // Start rand remove sign logic after Pyodide loads and editor is ready
  useEffect(() => {
    if (!isLoading) {
      // Wait a bit for editor to mount, then start rand remove sign
      const timer = setTimeout(() => {
        const startRandRemoveSign = (window as any).startRandRemoveSign;
        if (startRandRemoveSign) {
          startRandRemoveSign();
          console.log("!Rand remove sign logic started!");
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      
      {/* Header / Toolbar */}
      <header style={{ padding: '1px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Python Web IDE</h2>
        <button 
          onClick={() => runCode(code)} 
          disabled={isLoading}
          style={{ 
            backgroundColor: isLoading ? '#555' : '#4CAF50', 
            color: 'white', 
            padding: '5px 20px', 
            cursor: isLoading ? 'wait' : 'pointer',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {isLoading ? 'Loading Python...' : 'Run'}
        </button>
      </header>

      {/* Main Area: Editor and Console */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, borderRight: '1px solid #333' }}>
          <CodeEditor
            value={code}
            onChange={setCode}
          />
        </div>
        
        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#000', fontFamily: 'monospace' }}>
          <h4 style={{ marginTop: 0, color: '#888' }}>Console output:</h4>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
        </div>
      </main>

    </div>
  );
}

export default App;