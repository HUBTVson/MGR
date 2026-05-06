let _userId = '';
let _sessionId = '';

export function initLogger(userId: string, sessionId: string): void {
    _userId = userId;
    _sessionId = sessionId;

};

// -- helpers --

// Changes the table of console's arguments to one string
// objects are serialized with JSON, primitives are converted to string
function formatArgs(args: unknown[]): string {
    return args
        .map(a => {
            if (a instanceof Error) return `${a.name}: ${a.message}`;
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a);}
            catch { return String(a); }
        })
        .join(' ');
}

// Builds the single log line with timestamp and message
// [2024-06-01T12:00:00.000Z] [WARN] This is a warning message
function buildLogLine(level: string, message: string): string {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

// Sends the log line to the backend
// in case of logger loop (fetch error -> console.error -> sendLog -> ...)
function sendLog(line: string): void {
    fetch('/api/log', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId: _userId, sessionId: _sessionId, content: line})
    }).catch(() => {});
}

// Known Pyodide internal noise — not relevant to the study
const IGNORED_PATTERNS = [
    'Duplicate definition of module',
    'Loading "stackframe" failed',
    'error-stack-parser',
    'Here are the modules that depend on it',
    'object Event'
];

function isIgnored(message: string): boolean {
    return IGNORED_PATTERNS.some(p => message.includes(p));
}

// --- console patch ---
const LEVELS = ['log', 'warn', 'error'] as const;

for (const level of LEVELS) {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]) => {
        original(...args);
        if (!_userId) return;
        const message = formatArgs(args);
        if (isIgnored(message)) return;
        sendLog(buildLogLine(level, message));
    };
}