// Code Editor has access to the newest text (code) history.
// Its task is to connect his "skills" with the already created bridge (window.ideBridge).

import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPasteDetected?: () => void;
  isAdmin?: boolean;
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

  React.useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const detectPasteLike = (newValue: string): boolean => {
    const previousValue = latestValue.current;
    const now = Date.now();
    const timeDelta = now - lastChangeTime.current;
    const charDelta = newValue.length - previousValue.length;
    const lineDelta = newValue.split('\n').length - previousValue.split('\n').length;

    // Define thresholds for what constitutes a paste-like action
    // > 80 characters added or > 5 lines added, or > 40 characters added in less than 250ms
    const isLargeInsert = charDelta > 80 || lineDelta >= 5;
    const isFastInsert = charDelta > 40 && timeDelta < 250;

    if (isLargeInsert || isFastInsert) {
      // Admins are exempt from paste detection cooldown and warnings
      if (!isAdmin) {
        const violationCount = parseInt(sessionStorage.getItem('pasteViolationCount') || '0', 10);
        const durations = [30, 60, 120, 300];
        const duration = durations[Math.min(violationCount, durations.length - 1)];
        const cooldownUntil = Date.now() + duration * 1000;

        sessionStorage.setItem('cooldownUntil', String(cooldownUntil));
        sessionStorage.setItem('pasteViolationCount', String(violationCount + 1));
        onPasteDetected?.();
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

    // --- Syntax coloring corruption ---
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

    // --- Tab/space perturbation ---
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

      if ((convertTabToSpaces && hasTabs) || (!hasSpaces && hasTabs)) {
        const matches = model.findMatches('\t', false, false, false, null, false);
        for (const m of matches) edits.push({ range: m.range, text: '    ' });
      } else if ((!convertTabToSpaces && hasSpaces) || (!hasTabs && hasSpaces)) {
        const matches = model.findMatches('    ', false, false, false, null, false);
        for (const m of matches) edits.push({ range: m.range, text: '\t' });
      }

      if (edits.length > 0) {
        programmaticEditRef.current = true;
        ed.executeEdits("perturbation", edits);
        programmaticEditRef.current = false;
      }
    };

    // --- Unified content change handler ---
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

      if (syntaxColorCountRef.current >= 30) {
        highlightRandomKeyword();
        syntaxColorCountRef.current = 0;
      }

      if (perturbationCountRef.current >= 40) {
        performPerturbation();
        perturbationCountRef.current = 0;
      }
    });

    // --- Bridge for Python corruption engine ---
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
