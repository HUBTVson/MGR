import { useState, useEffect } from 'react';
import CodeEditor from './components/CodeEditor';
import Login from './components/Login';
import { usePyodide } from './experiment/usePyodide';
import './App.css';

// Interface for task structure
interface Task {
  id: number;
  title: string;
  description: string;
  initialCode: string;
  corruptionLimit: number; // Number of characters from start that are protected
  tests: Array<{ input: string; expectedOutput: string; description: string }>;
}

// Array of 3 tasks with different objectives
const tasks: Task[] = [
  {
    id: 1,
    title: 'Zadanie 1: Równanie',
    description: `Dane jest równanie "A · X + B · Y = C", gdzie A, B, C są liczbami całkowitymi, a X, Y są zmiennymi. Napisz program, który w pierwszej linii przyjmuje trzy liczby całkowite A, B, C, a w drugiej linii zmienne X, Y. 
Program powinien sprawdzić, czy równanie jest spełnione dla podanych wartości, a następnie wypisać "TAK" lub "NIE".
Przykład:
Wejście:
2 3 5
1 1
Wyjście:
TAK`.trim(),
    corruptionLimit: 0,
    initialCode: `    `.trim(),
    tests: [
      {
        input: '2 3 5\n1 1',
        expectedOutput: 'TAK',
        description: 'Równanie jest prawdziwe',
      },
      {
        input: '2 3 5\n0 0',
        expectedOutput: 'NIE',
        description: 'Równanie jest fałszywe',
      },
    ],
  },
  {
    id: 2,
    title: 'Zadanie 2: Suma liczb parzystych',
    description: 'Oblicz sumę wszystkich liczb parzystych od 1 do 100.',
    corruptionLimit: 0,
    tests: [
      {
        input: '',
        expectedOutput: 'Sum of even numbers from 1 to 100: 2550',
        description: 'Stały wynik sumy liczb parzystych',
      },
    ],
    initialCode: `
# Task 2: Sum of even numbers
total = 0

for num in range(1, 101):
    if num % 2 == 0:
        total += num

print(f"Sum of even numbers from 1 to 100: {total}")
    `.trim(),
  },
  {
    id: 3,
    title: 'Zadanie 3: Sprawdzanie liczb pierwszych',
    description: 'Sprawdź, czy liczba jest pierwsza.',
    corruptionLimit: 0,
    tests: [
      {
        input: '',
        expectedOutput: '17 is prime: True\n24 is prime: False\n31 is prime: True\n100 is prime: False',
        description: 'Sprawdzenie poprawnych wyników dla przykładowych liczb',
      },
    ],
    initialCode: `
# Task 3: Check if number is prime
def is_prime(n):
    if n < 2:
        return False
    
    for i in range(2, int(n ** 0.5) + 1):
        if n % i == 0:
            return False
    
    return True

# Test with some numbers
test_numbers = [17, 24, 31, 100]

for num in test_numbers:
    print(f"{num} is prime: {is_prime(num)}")
    `.trim(),
  },
];

interface EditorPageProps {
  task: Task;
  code: string;
  setCode: (value: string) => void;
  isAdmin: boolean;
  taskIndex: number;
  totalTasks: number;
  onNextTask: () => void;
}

const EditorPage: React.FC<EditorPageProps> = ({
  task,
  code,
  setCode,
  isAdmin,
  taskIndex,
  totalTasks,
  onNextTask,
}) => {
  const { isLoading, output, runCode, runCodeWithInput } = usePyodide();
  // State to toggle description visibility
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [unlockTime, setUnlockTime] = useState<number>(Date.now() + 5 * 60 * 1000);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setSubmitSuccess(false);
    setSubmitMessage("");
    setUnlockTime(Date.now() + 5 * 60 * 1000);
  }, [taskIndex]);

  useEffect(() => {
    const interval = setInterval(() => setTick((current) => current + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const nextTaskAvailable = submitSuccess || Date.now() >= unlockTime;
  const nextTaskRemainingSeconds = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));

  useEffect(() => {
    if (!isLoading) {
      // Set corruption limit for current task
      const setCorruptionLimit = (window as any).setCorruptionLimit;
      if (setCorruptionLimit) {
        setCorruptionLimit(task.corruptionLimit);
        console.log(`Set corruption limit to ${task.corruptionLimit} for ${task.title}`);
      }
      
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
  }, [isLoading, isAdmin, task]);

  const normalizeOutput = (output: string) => {
    return output
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line, index, arr) => !(line === '' && index === arr.length - 1))
      .join('\n');
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
            <p style={{ margin: '8px 0 5px 30px', fontSize: '12px', color: '#aaa', whiteSpace: 'pre-wrap' }}>
              {task.description}
            </p>
          )}
          
          <span style={{ fontSize: '11px', color: '#888', marginLeft: '30px' }}>Task {taskIndex + 1}/{totalTasks}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setSubmitMessage('');
              runCode(code);
            }}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#555' : '#4CAF50',
              color: 'white',
              padding: '8px 20px',
              cursor: isLoading ? 'wait' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            {isLoading ? 'Loading Python...' : 'Run'}
          </button>

          <button
            onClick={async () => {
              if (!runCodeWithInput) return;
              setSubmitMessage('Sprawdzanie kodu...');

              const results = [];
              for (const test of task.tests) {
                const result = await runCodeWithInput(code, test.input);
                const normalizedOutput = normalizeOutput(result.output);
                const expectedOutput = normalizeOutput(test.expectedOutput);
                const pass = result.success && normalizedOutput === expectedOutput;
                results.push({ test, result, pass, actual: normalizedOutput });
              }

              const failed = results.filter(r => !r.pass);
              if (failed.length === 0) {
                const message = 'Submit passed: wszystkie testy przeszły.';
                setSubmitMessage(message);
                setSubmitSuccess(true);
                console.log(message);
              } else {
                const f = failed[0];
                const message = `Błąd dla danych wejściowych: ${JSON.stringify(f.test.input)}\nOczekiwano: ${f.test.expectedOutput}\nOtrzymano: ${f.result.error ? f.result.error : f.actual || '<brak wyjścia>'}`;
                setSubmitMessage(`Submit nie powiódł się:\n${message}`);
                console.log('Submit failed:', message);
              }
            }}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#555' : '#FFC107',
              color: '#000',
              padding: '8px 20px',
              cursor: isLoading ? 'wait' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              whiteSpace: 'nowrap',
            }}
          >
            Submit
          </button>

          <button
            onClick={taskIndex >= totalTasks - 1 ? () => alert('Dziękujemy za uczestnictwo w badaniu!') : onNextTask}
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
          <CodeEditor value={code} onChange={setCode} />
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
  // Track authentication status
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Track if logged-in user is admin
  const [isAdmin, setIsAdmin] = useState(false);
  // Track current task index (0-2)
  const [taskIndex, setTaskIndex] = useState(0);
  // Initialize code state with first task's code
  const [code, setCode] = useState<string>(tasks[0].initialCode);

  // Set initial corruption limit for first task
  useEffect(() => {
    const setCorruptionLimit = (window as any).setCorruptionLimit;
    if (setCorruptionLimit) {
      setCorruptionLimit(tasks[0].corruptionLimit);
      console.log(`Initial corruption limit set to ${tasks[0].corruptionLimit}`);
    }
  }, []);

  // Handle task navigation - load next task code and set corruption limit
  const handleNextTask = () => {
    if (taskIndex < tasks.length - 1) {
      const nextIndex = taskIndex + 1;
      setTaskIndex(nextIndex);
      setCode(tasks[nextIndex].initialCode);
      
      // Set the corruption limit for the new task
      const setCorruptionLimit = (window as any).setCorruptionLimit;
      if (setCorruptionLimit) {
        setCorruptionLimit(tasks[nextIndex].corruptionLimit);
        console.log(`Set corruption limit to ${tasks[nextIndex].corruptionLimit} for ${tasks[nextIndex].title}`);
      }
      
      console.log(`Moving to ${tasks[nextIndex].title}`);
    }
  };

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

  return (
    <EditorPage
      task={tasks[taskIndex]}
      code={code}
      setCode={setCode}
      isAdmin={isAdmin}
      taskIndex={taskIndex}
      totalTasks={tasks.length}
      onNextTask={handleNextTask}
    />
  );
}

export default App;