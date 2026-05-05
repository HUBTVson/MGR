// Code Editor has access to the newest text (code) history.
// Its task is to connect his "skills" with the already created bridge (window.ideBridge).

import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPasteDetected?: () => void;
  isAdmin?: boolean;
  userId: string;
  height?: string;
  defaultLanguage?: string;
  theme?: string;
  options?: any;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  onPasteDetected,
  isAdmin = false,
  height = "100%",
  userId,
  options = { fontSize: 14, minimap: { enabled: false } }
}) => {

  const latestValue = React.useRef(value);
  const lastChangeTime = React.useRef(Date.now());
  const editorRef = React.useRef<any>(null);
  const activeDecorationIdsRef = React.useRef<string[]>([]);
  const programmaticEditRef = React.useRef(false);
  // Unified counters — both count only real single-char keystrokes
  const syntaxColorCountRef = React.useRef(0);
  const perturbationCountRef = React.useRef(0);
  const swapCountRef = React.useRef(0);

  React.useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const detectPasteLike = async (newValue: string): Promise<boolean> => {
  const previousValue = latestValue.current;
  const now = Date.now();
  const timeDelta = now - lastChangeTime.current;
  const charDelta = newValue.length - previousValue.length;
  const lineDelta = newValue.split('\n').length - previousValue.split('\n').length;

  const isLargeInsert = charDelta > 80 || lineDelta >= 5;
  const isFastInsert = charDelta > 40 && timeDelta < 250;

  if ((isLargeInsert || isFastInsert) && !isAdmin) {
    console.log("Wykryto paste-like behavior. Synchronizacja z backendem...");

    try {
      const response = await fetch('/api/record-paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isAdmin }),
      });

      if (response.ok) {
        const data = await response.json();
        // Backend zwraca dane z config.json!
        sessionStorage.setItem('cooldownUntil', String(data.cooldownUntil));
        sessionStorage.setItem('pasteViolationCount', String(data.violationCount));
        onPasteDetected?.();
      }
    } catch (err) {
      console.error("Błąd połączenia przy rejestrowaniu wklejenia:", err);
    }
    return true;
  }

  lastChangeTime.current = now;
  latestValue.current = newValue;
  return false;
};

  // Building the bridge for Python code to interact with the editor
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Syntax coloring corruption
    // Highlights a random Python keyword in red; decoration persists for the session
    const highlightRandomKeyword = () => {
      const ed = editorRef.current;
      if (!ed) return;
      const model = ed.getModel();
      if (!model) return;

      const pythonKeywords = [
        'class', 'continue', 'def', 'for', 'return'
      ];

      const keywordPattern = new RegExp(`\\b(${pythonKeywords.join('|')})\\b`, 'g');
      const candidates: { line: number; startCol: number; endCol: number }[] = [];

      // Read live decoration ranges from Monaco (auto-tracked through edits)
      const existingRanges = activeDecorationIdsRef.current
        .map(id => model.getDecorationRange(id))
        .filter(Boolean);

      for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
        const lineText = model.getLineContent(lineNumber);
        let match;
        keywordPattern.lastIndex = 0;
        while ((match = keywordPattern.exec(lineText)) !== null) {
          const startCol = match.index + 1;
          const endCol = startCol + match[0].length;

          const alreadyDecorated = existingRanges.some((r: any) =>
            r.startLineNumber === lineNumber &&
            r.startColumn === startCol &&
            r.endColumn === endCol
          );

          if (!alreadyDecorated) {
            candidates.push({ line: lineNumber, startCol, endCol });
          }
        }
      }

      if (candidates.length === 0) return;

      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      const range = new monaco.Range(picked.line, picked.startCol, picked.line, picked.endCol);

      // Add only the new decoration; existing ones are tracked by Monaco via IDs
      const newIds = ed.deltaDecorations([], [{
        range,
        options: {
          inlineClassName: 'my-red-keyword',
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      }]);

      activeDecorationIdsRef.current.push(...newIds);
    };

    // Letter swap corruption
    // Randomly swaps two adjacent characters inside a random word
    const performLetterSwap = () => {
      const ed = editorRef.current;
      if (!ed) return;
      const model = ed.getModel();
      if (!model) return;

    // Collect words with at least of 3 letters
    const wordPattern = /[a-zA-Z]{3,}/g;
    const candidates: { line:number; startCol:number; word:string}[] = [];

    for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
      const lineText = model.getLineContent(lineNumber);
      let match;
      wordPattern.lastIndex = 0;
      while ((match = wordPattern.exec(lineText)) !== null) {
        candidates.push({ line: lineNumber, startCol: match.index + 1, word: match[0]});
      }
    }

    if (candidates.length ===0) return;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const word = picked.word;

    // Swap a random adjacent pair (not at index 0 to keep first letter unharmed)
    const swapIndex = Math.floor(Math.random() * (word.length - 2)) + 1;
    const swapped = 
      word.slice(0, swapIndex) +
      word[swapIndex + 1] +
      word[swapIndex] +
      word.slice(swapIndex + 2);

    if (swapped === word) return; // just in case, because should not happen

    const range = new monaco.Range(
      picked.line, picked.startCol,
      picked.line, picked.startCol + word.length
    );

    programmaticEditRef.current = true;
    ed.executeEdits("LetterSwap", [{ range, text: swapped }]);
    programmaticEditRef.current = false;
  };

    // Tab/Space perturbation
    // Uses executeEdits for targeted replacements so decorations are preserved
    const performPerturbation = () => {
      const ed = editorRef.current;
      if (!ed) return;
      const model = ed.getModel();
      if (!model) return;
      const content = model.getValue();

      const hasTabs = /\t/.test(content);
      const hasSpaces = / {3}/.test(content);
      if (!hasTabs && !hasSpaces) return;

      const convertTabToSpaces = Math.random() < 0.5;
      const edits: any[] = [];

      // Decide direction and find matches
      let searchFor: string;
      let replaceWith: string;

      if (convertTabToSpaces && hasTabs) {
        searchFor = '\t';
        replaceWith = '    ';
      } else if (!convertTabToSpaces && hasSpaces) {
        searchFor = '    ';
        replaceWith = '\t';
      } else if (hasTabs) {
        searchFor = '\t';
        replaceWith = '    ';
      } else {
        searchFor = '    ';
        replaceWith = '\t';
      }

      const matches = model.findMatches(searchFor, false, false, false, null, false);
      for (const m of matches) {
        edits.push({ range: m.range, text: replaceWith });
      }

      if (edits.length > 0) {
        programmaticEditRef.current = true;
        ed.executeEdits("perturbation", edits);
        programmaticEditRef.current = false;
      }
    };

    // Unified content change handler
    // Counts only real keystrokes (single-char inserts); ignores programmatic edits
    editor.onDidChangeModelContent((e: any) => {
      let manualKeystrokes = 0;
      for (const change of e.changes) {
        if (change.text.length === 1 && change.rangeLength === 0) {
          manualKeystrokes += 1;
        }
      }
      if (manualKeystrokes === 0 || isAdmin) return;

      syntaxColorCountRef.current += manualKeystrokes;
      perturbationCountRef.current += manualKeystrokes;
      swapCountRef.current += manualKeystrokes;

      if (syntaxColorCountRef.current >= 30) {
        highlightRandomKeyword();
        syntaxColorCountRef.current = 0;
      }

      if (perturbationCountRef.current >= 40) {
        performPerturbation();
        perturbationCountRef.current = 0;
      }

      if (swapCountRef.current >= 60) {
        performLetterSwap();
        swapCountRef.current = 0;
      }
    });

    // Bridge for Python corruption engine
    const bridge = (window as any).ideBridge;
    if (!bridge) return;

    bridge.getEditorContent = () => latestValue.current;

    bridge.deleteCharacterIndex = (index: number) => {
      const model = editor.getModel();
      if (!model) return;

      const position = model.getPositionAt(index);
      const range = new monaco.Range(
        position.lineNumber, position.column,
        position.lineNumber, position.column + 1
      );

      programmaticEditRef.current = true;
      editor.executeEdits("corruption_logic", [{ range, text: "" }]);
      programmaticEditRef.current = false;
    };
  };

  return (
    <Editor
      height={height}
      defaultLanguage="python"
      theme="vs-dark"
      value={value}
      onChange={(newValue) => {
        const nextValue = newValue || "";
        // Skip paste detection for programmatic edits (perturbation, char deletion)
        if (!programmaticEditRef.current) {
          detectPasteLike(nextValue);
        }
        onChange(nextValue);
      }}
      onMount={handleEditorMount}
      options={options}
    />
  );
};

export default CodeEditor;
