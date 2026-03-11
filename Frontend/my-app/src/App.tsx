import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

function App() {
  const [code, setCode] = useState<string | undefined>('# Napisz swój kod w Pythonie\nprint("Witaj świecie!")');
  const [output, setOutput] = useState<string>('');
  const [pyodide, setPyodide] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. Ładowanie Pyodide przy starcie aplikacji
  useEffect(() => {
    async function initPyodide() {
      try {
        // @ts-ignore - szukamy funkcji zdefiniowanej w index.html przez skrypt CDN
        const py = await window.loadPyodide();
        setPyodide(py);
        setIsLoading(false);
      } catch (err) {
        console.error("Błąd ładowania Pyodide:", err);
        setOutput("Nie udało się załadować silnika Python.");
      }
    }
    initPyodide();
  }, []);

  // 2. Funkcja uruchamiająca kod
  const runCode = async () => {
    if (!pyodide) return;

    setOutput("Uruchamianie...");
    try {
      // Przechwytywanie standardowego wyjścia (print) do konsoli w UI
      let resultStr = "";
      pyodide.setStdout({
        batched: (str: string) => {
          resultStr += str + "\n";
          setOutput(resultStr);
        },
      });

      await pyodide.runPythonAsync(code);
    } catch (err) {
      setOutput(`Błąd: ${err}`);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      
      {/* Header / Toolbar */}
      <header style={{ padding: '10px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Python Web IDE</h2>
        <button 
          onClick={runCode} 
          disabled={isLoading}
          style={{ 
            backgroundColor: isLoading ? '#555' : '#4CAF50', 
            color: 'white', 
            padding: '5px 20px', 
            cursor: isLoading ? 'not-allowed' : 'pointer',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {isLoading ? 'Ładowanie Pythona...' : 'Uruchom (Run)'}
        </button>
      </header>

      {/* Główny obszar: Edytor i Konsola */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, borderRight: '1px solid #333' }}>
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value)}
            options={{ fontSize: 14, minimap: { enabled: false } }}
          />
        </div>
        
        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#000', fontFamily: 'monospace' }}>
          <h4 style={{ marginTop: 0, color: '#888' }}>Konsola wyjściowa:</h4>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
        </div>
      </main>

    </div>
  );
}

export default App;