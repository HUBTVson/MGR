import { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import Login from './components/Login';
import { usePyodide } from './experiment/usePyodide';
import { initFreezeConfig, applyRandomFreeze } from './experiment/freeze';
import { useCooldown } from './hooks/useCooldown';
import { useRecorder } from './hooks/useRecorder';
import './App.css';

// Interface for task structure
interface Task {
  id: number;
  title: string;
  description: string;
  initialCode: string;
  corruptionLimit: number; // Number of characters from start that are protected
}


interface EditorPageProps {
  task: Task;
  code: string;
  setCode: (value: string) => void;
  isAdmin: boolean;
  taskIndex: number;
  totalTasks: number;
  onNextTask: () => void;
  userId: string;
  onFinish: () => void;
}

const EditorPage: React.FC<EditorPageProps> = ({
  task,
  code,
  setCode,
  isAdmin,
  taskIndex,
  totalTasks,
  onNextTask,
  userId,
  onFinish,
}) => {
  const { isLoading, output, runCode } = usePyodide(isAdmin);
  const cooldownTimeLeft = useCooldown();
  const [pasteWarning, setPasteWarning] = useState('');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [unlockTime, setUnlockTime] = useState<number>(Date.now() + 2 * 60 * 1000);
  const [_tick, setTick] = useState(0);

  useEffect(() => {
    setSubmitSuccess(false);
    setSubmitMessage("");
    setUnlockTime(Date.now() + 2 * 60 * 1000);
  }, [taskIndex]);

  useEffect(() => {
    const interval = setInterval(() => setTick((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const nextTaskRemainingSeconds = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));

  useEffect(() => {
  if (!isLoading) {
    const initCorruption = async () => {
      try {
        const res = await fetch('/api/corruption');
        if (!res.ok) throw new Error('Błąd pobierania konfiguracji');
        const config = await res.json();
        
        const { min_interval_ms, max_interval_ms } = config;

        const setCorruptionLimit = (window as any).setCorruptionLimit;
        if (setCorruptionLimit) {
          setCorruptionLimit(task.corruptionLimit);
          console.log(`[Corruption] Limit dla zadania "${task.title}": ${task.corruptionLimit}`);
        }

        const startRandRemoveSign = (window as any).startRandRemoveSign;
        if (startRandRemoveSign && !isAdmin) {
          startRandRemoveSign(min_interval_ms, max_interval_ms);
          console.log(`[Corruption] Start: interwał ${min_interval_ms}ms - ${max_interval_ms}ms`);
        } else if (isAdmin) {
          console.log("[Corruption] Tryb admina: logika wyłączona.");
        }
      } catch (err) {
        console.error("[Corruption] Błąd inicjalizacji:", err);
      }
    };

    const timer = setTimeout(() => {
      initCorruption();
    }, 500);

    return () => clearTimeout(timer);
  }
}, [isLoading, isAdmin, task]);

  const normalizeOutput = (output: string) => {
    return output
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line, index, arr) => !(line === '' && index === arr.length - 1))
      .join('\n');
  };

  const handlePasteDetected = () => {
    setPasteWarning('Dlaczego wklejasz gotowy kod!? Napisz go samodzielnie!!');
    setTimeout(() => setPasteWarning(''), 10000);

    // If Next Task button is locked, add the cooldown time as extra penalty
    setUnlockTime(prev => {
      if (Date.now() >= prev) return prev; // already unlocked, no penalty
      const cooldownUntil = parseInt(sessionStorage.getItem('cooldownUntil') || '0', 10);
      const penalty = Math.max(0, cooldownUntil - Date.now());
      return prev + penalty;
    });
  };

  useEffect(() => {
    initFreezeConfig();
  }, []);

  const handleRun = async () => {
    if (cooldownTimeLeft > 0) {
      alert(`Cooldown: czekaj ${cooldownTimeLeft}s`);
      return;
    }

    try {
      const response = await fetch('/api/check-cooldown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isAdmin })
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

      if (!isAdmin) applyRandomFreeze();
      runCode(code);
    } catch (err) {
      console.error('Backend check failed:', err);
      runCode(code); // Fallback when backend is unavailable
    }
  };

  return (
    <div style={{ position: 'relative', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      {/* Header with task info and buttons */}
      <header style={{ padding: '10px 15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Toggle button for description */}
            <button
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0',
                minWidth: '20px',
              }}
              title={isDescriptionExpanded ? 'Collapse description' : 'Expand description'}
            >
              {isDescriptionExpanded ? '▼' : '▶'}
            </button>
            <h2 style={{ margin: 0 }}>{task.title} {isAdmin ? '(admin)' : ''}</h2>
          </div>

          {/* Description - conditionally rendered */}
          {isDescriptionExpanded && (
            <p style={{ margin: '8px 0 5px 30px', fontSize: '14px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
              {task.description}
            </p>
          )}

          <span style={{ fontSize: '11px', color: '#888', marginLeft: '30px' }}>Task {taskIndex + 1}/{totalTasks}</span>
          {pasteWarning && <p style={{ color: '#ff9800', margin: '5px 0 0 30px', fontSize: '12px' }}>{pasteWarning}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setSubmitMessage('');
              handleRun();
            }}
            disabled={isLoading || cooldownTimeLeft > 0}
            style={{
              backgroundColor: cooldownTimeLeft > 0 ? '#ff6b6b' : (isLoading ? '#555' : '#4CAF50'),
              color: 'white',
              padding: '8px 20px',
              cursor: isLoading || cooldownTimeLeft > 0 ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            {cooldownTimeLeft > 0 ? `Run (${cooldownTimeLeft}s)` : isLoading ? 'Loading Python...' : 'Run'}
          </button>

          <button
            onClick={async () => {
              if (!runCode) return;

              if (cooldownTimeLeft > 0) {
                alert(`Cooldown: czekaj ${cooldownTimeLeft}s`);
                return;
              }

              setSubmitMessage('Uruchamianie testów jednostkowych...');
              setSubmitSuccess(false);

              try {
                const response = await fetch(`/api/tasks/${task.id}/test-script`);
                if (!response.ok) throw new Error('Nie udało się pobrać skryptu testowego');
                const data = await response.json();

                const fullCode = `${code}\n\n${data.test_script}`;

                const result = await runCode(fullCode);

                if (result.success) {
                  setSubmitMessage(`Sukces! Wszystkie testy zaliczone.\n${result.output}`);
                  setSubmitSuccess(true);
                } else {
                  setSubmitMessage(`Błąd testu:\n${result.error}`);
                }
              } catch (err) {
                console.error(err);
                setSubmitMessage('Błąd krytyczny podczas sprawdzania kodu.');
              }
            }}
            disabled={isLoading || cooldownTimeLeft > 0}
            style={{
              backgroundColor: cooldownTimeLeft > 0 ? '#ff6b6b' : (isLoading ? '#555' : '#FFC107'),
              color: cooldownTimeLeft > 0 ? 'white' : '#000',
              padding: '8px 20px',
              cursor: isLoading || cooldownTimeLeft > 0 ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            {cooldownTimeLeft > 0 ? `Submit (${cooldownTimeLeft}s)` : 'Submit'}
          </button>

          <button
            onClick={taskIndex >= totalTasks - 1
              ? async () => {
                try { await onFinish(); } catch (err) { console.error('[Finish] Recording stop failed:', err); }
                alert('Dziękujemy za uczestnictwo w badaniu!');
              }
              : onNextTask}
            disabled={!(submitSuccess || Date.now() >= unlockTime)}
            style={{
              backgroundColor: !(submitSuccess || Date.now() >= unlockTime) ? '#555' : '#2196F3',
              color: 'white',
              padding: '8px 20px',
              cursor: !(submitSuccess || Date.now() >= unlockTime) ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            {taskIndex >= totalTasks - 1 ? 'Finish' : 'Next Task'} {!submitSuccess && Date.now() < unlockTime ? `(${nextTaskRemainingSeconds}s)` : taskIndex >= totalTasks - 1 ? '' : '→'}
          </button>
        </div>
      </header>

      {/* Main Area: Editor and Console */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, borderRight: '1px solid #333' }}>
          <CodeEditor value={code} onChange={setCode} onPasteDetected={handlePasteDetected} isAdmin={isAdmin} userId={userId} />
        </div>

        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#000', fontFamily: 'monospace' }}>
          <h4 style={{ marginTop: 0, color: '#888' }}>Console output:</h4>
          <pre style={{ whiteSpace: 'pre-wrap', minHeight: '260px', color: '#fff', lineHeight: '1.4', margin: 0 }}>
            {submitMessage ? submitMessage : output || ""}
          </pre>
        </div>
      </main>
    </div>
  );
};

function App() {
  const [user, setUser] = useState<{ id: string; role: 'admin' | 'user' } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [code, setCode] = useState<string>('');
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [sessionId] = useState(() => String(Date.now()));

  const { start, stop } = useRecorder();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoadingTasks(true);
      fetch('/api/tasks')
        .then((res) => res.json())
        .then((data: Task[]) => {
          setTasks(data);
          if (data.length > 0) {
            setCode(data[0].initialCode);
          }
          setIsLoadingTasks(false);
        })
        .catch((err) => {
          console.error("Błąd podczas pobierania zadań:", err);
          setIsLoadingTasks(false);
        });
    }
  }, [isAuthenticated]);

  const handleNextTask = () => {
    if (taskIndex < tasks.length - 1) {
      const nextIndex = taskIndex + 1;
      const nextTask = tasks[nextIndex];

      setTaskIndex(nextIndex);
      setCode(nextTask.initialCode);

      console.log(`Moving to task: ${nextTask.title}`);
    }
  };

  // Widok logowania
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(userCode, admin) => {
          // Czyszczenie starych danych sesji
          sessionStorage.removeItem('cooldownUntil');

          // Ustawienie ustrukturyzowanego użytkownika
          setUser({ id: userCode, role: admin ? 'admin' : 'user' });

          // Start nagrywania tylko dla zwykłych użytkowników
          if (!admin) {
            start(userCode, sessionId);
          }
        }}
      />
    );
  }

  // Widok ładowania
  if (isLoadingTasks) {
    return <div className="loading-screen">Pobieranie zadań z serwera...</div>;
  }

  if (tasks.length === 0) {
    return <div className="loading-screen">Inicjalizacja zadań...</div>;
  }

  // Główny interfejs edytora
  return (
    <EditorPage
      task={tasks[taskIndex]}
      code={code}
      setCode={setCode}
      isAdmin={isAdmin}
      taskIndex={taskIndex}
      totalTasks={tasks.length}
      onNextTask={handleNextTask}
      userId={user?.id || ''}
      onFinish={stop}
    />
  );
}

export default App;