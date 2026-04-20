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
  const manualCharCountRef = React.useRef(0);

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

  const performPerturbation = (currentValue: string): string | null => {
    const corruptionFn = (window as any).performTabSpaceCorruption;
    if (typeof corruptionFn === 'function') {
      const result = corruptionFn(currentValue);
      return typeof result === 'string' ? result : null;
    }

    const hasTabs = /\t/.test(currentValue);
    const hasSpaces = / {3}/.test(currentValue);

    if (!hasTabs && !hasSpaces) return null;

    // Fallback when Python corruption engine is not ready
    const convertTabToSpaces = Math.random() < 0.5;
    return convertTabToSpaces
      ? currentValue.replace(/\t/g, '    ')
      : currentValue.replace(/ {3}/g, '\t');
  };

  // Building the bridge for Python code to interact with the editor
  const handleEditorMount = (editor: any, monaco: any) => {
    const bridge = (window as any).ideBridge;
    if (!bridge) return;
    // Allows the Python code to understand the current content of the editor
    bridge.getEditorContent = () => latestValue.current;

    // Allows the Python code to delete a character at a specific index in the editor
    bridge.deleteCharacterIndex = (index: number) => {
      const model = editor.getModel();
      if (!model) return;

      const position = model.getPositionAt(index);
      const range = new monaco.Range(
        position.lineNumber, position.column,
        position.lineNumber, position.column + 1
      );

      editor.executeEdits("corruption_logic", [
        { range: range, text: ""}
      ]);
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
        const previousValue = latestValue.current;
        const isPaste = detectPasteLike(nextValue);
        let finalValue = nextValue;

        if (!isPaste) {
          const addedChars = nextValue.length - previousValue.length;
          if (addedChars > 0) {
            manualCharCountRef.current += addedChars;
            if (manualCharCountRef.current >= 40) {
              if(!isAdmin) {
              const perturbedValue = performPerturbation(nextValue);
              if (perturbedValue) {
                finalValue = perturbedValue;
              }
            }
              manualCharCountRef.current = 0;
            }
          }
        }

        onChange(finalValue);
      }}
      onMount={handleEditorMount}
      options={options}
    />
  );
};

export default CodeEditor;
