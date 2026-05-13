import { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import Login from './components/Login';
import { usePyodide } from './experiment/usePyodide';
import { initFreezeConfig, applyRandomFreeze } from './experiment/freeze';
import { startRandRemoveSign, setCorruptionLimit, stopRandRemoveSign } from './experiment/randRemoveSign';
import { useCooldown } from './hooks/useCooldown';
import { useRecorder } from './hooks/useRecorder';
import { initLogger, shutdownLogger } from './hooks/useSessionLogger';
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
  const [testScript, setTestScript] = useState<string>('');

  useEffect(() => {
    setSubmitSuccess(false);
    setSubmitMessage("");
    setUnlockTime(Date.now() + 2 * 60 * 1000);
    fetch(`/api/tasks/${task.id}/test-script`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setTestScript(data?.test_script ?? ''))
      .catch(() => setTestScript(''));
  }, [taskIndex]);

  useEffect(() => {
    const interval = setInterval(() => setTick((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const nextTaskRemainingSeconds = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));

  useEffect(() => {
  if (!isLoading) {
    const initCorruption = async () => {
      let min_interval_ms = 40000;
      let max_interval_ms = 60000;

      try {
        const res = await fetch('/api/corruption');
        if (!res.ok) throw new Error('Błąd pobierania konfiguracji');
        const config = await res.json();
        min_interval_ms = config.min_interval_ms;
        max_interval_ms = config.max_interval_ms;
      } catch (err) {
        console.error("[Corruption] Błąd pobierania konfiguracji, używam domyślnych wartości:", err);
      }

      setCorruptionLimit(task.corruptionLimit);

      if (!isAdmin) {
        startRandRemoveSign(min_interval_ms, max_interval_ms);
      }
    };

    const timer = setTimeout(() => {
      initCorruption();
    }, 500);

    return () => clearTimeout(timer);
  }
}, [isLoading, isAdmin, task]);

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

      // Run with test_script to actually invoke the function (reveals runtime errors),
      // but suppress AssertionError so only real errors (NameError, SyntaxError, etc.) are shown.
      if (testScript) {
        const wrappedTest = `try:\n${testScript.split('\n').map((l: string) => `    ${l}`).join('\n')}\nexcept AssertionError:\n    pass`;
        runCode(`${code}\n\n${wrappedTest}`);
      } else {
        runCode(code);
      }
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

          <span style={{ fontSize: '11px', color: '#888', marginLeft: '30px' }}>Zadanie {taskIndex + 1}/{totalTasks}</span>
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
            {cooldownTimeLeft > 0 ? `Uruchom (${cooldownTimeLeft}s)` : isLoading ? 'Ładowanie...' : 'Uruchom'}
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
                if (!testScript) throw new Error('Brak skryptu testowego');

                const fullCode = `${code}\n\n${testScript}`;

                const result = await runCode(fullCode);

                if (result && result.success) {
                  setSubmitMessage(`Sukces! Wszystkie testy zaliczone.\n${result.output}`);
                  setSubmitSuccess(true);
                } else if (result) {
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
            {cooldownTimeLeft > 0 ? `Sprawdź rozwiązanie (${cooldownTimeLeft}s)` : 'Sprawdź rozwiązanie'}
          </button>

          <button
            onClick={taskIndex >= totalTasks - 1
              ? async () => {
                  try { stopRandRemoveSign(); await onFinish(); } catch (err) { console.error('[Finish] Recording stop failed:', err); }
                  shutdownLogger();
                  alert('Bardzo dziękujemy za uczestnictwo w badaniu! \nMożesz teraz bezpiecznie zamknąć stronę.');
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
            {taskIndex >= totalTasks - 1 ? 'Zakończ' : 'Następne zadanie'} {!submitSuccess && Date.now() < unlockTime ? `(${nextTaskRemainingSeconds}s)` : taskIndex >= totalTasks - 1 ? '' : '→'}
          </button>
        </div>
      </header>

      {/* Main Area: Editor and Console */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
        <div style={{ flex: 1, borderRight: '1px solid #333' }}>
          <CodeEditor value={code} onChange={setCode} onPasteDetected={handlePasteDetected} isAdmin={isAdmin} userId={userId} />
        </div>

        <div style={{ flex: 1, padding: '15px', overflowY: 'auto', backgroundColor: '#000', fontFamily: 'monospace' }}>
          <h4 style={{ marginTop: 0, color: '#888' }}>Wyjście konsoli:</h4>
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

  const { start, stop, saveCheckpoint, setCurrentTaskId, hasCameraError, retry, hasScreenShareStopped, hasCameraStopped } = useRecorder();

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';

  // Set initial corruption limit for first task
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoadingTasks(true);
      fetch('/api/tasks')
        .then((res) => res.json())
        .then((data: Task[]) => {
          setTasks(data);
          if (data.length > 0) {
            setCode(data[0].initialCode);
            if (!isAdmin) setCurrentTaskId(data[0].id);
          }
          setIsLoadingTasks(false);
        })
        .catch((err) => {
          console.error("Błąd podczas pobierania zadań:", err);
          setIsLoadingTasks(false);
        });
    }
  }, [isAuthenticated]);

  const handleNextTask = async () => {
    if (taskIndex < tasks.length - 1) {
      if (!isAdmin) await saveCheckpoint(tasks[taskIndex].id);

      const nextIndex = taskIndex + 1;
      setTaskIndex(nextIndex);
      setCode(tasks[nextIndex].initialCode);
      setCorruptionLimit(tasks[nextIndex].corruptionLimit);
      if (!isAdmin) setCurrentTaskId(tasks[nextIndex].id);
    }
  };

  if (hasCameraStopped && !isAdmin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: '#1e1e1e', color: 'white',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        gap: '24px', textAlign: 'center', padding: '20px',
      }}>
        <h1 style={{ color: '#f44336', fontSize: '2rem', margin: 0 }}>Study Terminated</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '520px', margin: 0, color: '#ccc' }}>
          Nagrywanie kamery zostało zatrzymane. Badanie zostało zakończone, a Twoje nagrania zostały zapisane.
          Możesz zamnknąć tę stronę.
        </p>
      </div>
    );
  }

  if (hasScreenShareStopped && !isAdmin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: '#1e1e1e', color: 'white',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        gap: '24px', textAlign: 'center', padding: '20px',
      }}>
        <h1 style={{ color: '#f44336', fontSize: '2rem', margin: 0 }}>Study Terminated</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '520px', margin: 0, color: '#ccc' }}>
          Nagrywanie ekranu zostało zatrzymane. Badanie zostało zakończone, a Twoje nagrania zostały zapisane.
          Możesz zamnknąć tę stronę.
        </p>
      </div>
    );
  }

  if (hasCameraError && !isAdmin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: '#1e1e1e', color: 'white',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        gap: '24px', textAlign: 'center', padding: '20px',
      }}>
        <h1 style={{ color: '#f44336', fontSize: '2rem', margin: 0 }}>Camera Required</h1>
        <p style={{ fontSize: '1.1rem', maxWidth: '480px', margin: 0, color: '#ccc' }}>
          Camera is obligatory to move forward. Please connect a camera and try again.
        </p>
        <button
          onClick={retry}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            padding: '12px 32px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

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
            initLogger(userCode, sessionId);
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