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
}

// Array of 3 tasks with different objectives
const tasks: Task[] = [
  {
    id: 1,
    title: 'Task 1: Word Frequency Counter',
    description: 'Count the frequency of each word in the given text.',
    corruptionLimit: 200, // Protect the text and initial setup
    initialCode: `
# Task 1: Count word frequency
text = """Three Rings for the Elven-kings under the sky,
Seven for the dwarf-lords in their halls of stone,
Nine for Mortal Men doomed to die,
One for the Dark Lord on his dark throne,
In the Land of Mordor where the Shadows lie.
One Ring to rule them all, One Ring to find them,
One Ring to bring them all and in the darkness bind them
In the Land of Mordor where the Shadows lie."""

# Remove punctuation and split into words
for char in ",.~":
    text = text.replace(char, "")

words = text.split()

# Count word frequency
counts = {}
for word in words:
    counts[word] = counts.get(word, 0) + 1

print(counts)
    `.trim(),
  },
  {
    id: 2,
    title: 'Task 2: Sum of Even Numbers',
    description: 'Calculate the sum of all even numbers from 1 to 100.',
    corruptionLimit: 50, // Protect the comment and variable declaration
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
    title: 'Task 3: Prime Number Checker',
    description: 'Check if a number is prime.',
    corruptionLimit: 100, // Protect the function definition
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
  const { isLoading, output, runCode } = usePyodide();

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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', color: 'white' }}>
      {/* Header with task info and buttons */}
      <header style={{ padding: '10px 15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{task.title} {isAdmin ? '(admin)' : ''}</h2>
          <p style={{ margin: '5px 0', fontSize: '12px', color: '#aaa' }}>{task.description}</p>
          <span style={{ fontSize: '11px', color: '#888' }}>Task {taskIndex + 1}/{totalTasks}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => runCode(code)}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#555' : '#4CAF50',
              color: 'white',
              padding: '8px 20px',
              cursor: isLoading ? 'wait' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            {isLoading ? 'Loading Python...' : 'Run'}
          </button>

          {/* Next button - enabled only if not on last task */}
          <button
            onClick={onNextTask}
            disabled={taskIndex >= totalTasks - 1}
            style={{
              backgroundColor: taskIndex >= totalTasks - 1 ? '#555' : '#2196F3',
              color: 'white',
              padding: '8px 20px',
              cursor: taskIndex >= totalTasks - 1 ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            Next Task →
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
          <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
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