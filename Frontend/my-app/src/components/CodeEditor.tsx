// Code Editor has access to the newest text (code) history.
// Its task is to connect his "skills" with the already created bridge (window.ideBridge).

import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPasteDetected?: () => void;
  height?: string;
  defaultLanguage?: string;
  theme?: string;
  options?: any;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  onPasteDetected,
  height = "100%",
  options = { fontSize: 14, minimap: { enabled: false } }
}) => {

  const editorRef = React.useRef<any>(null);
  const latestValue = React.useRef(value);
  const lastChangeTime = React.useRef(Date.now());

  React.useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const detectPasteLike = (newValue: string) => {
    const previousValue = latestValue.current;
    const now = Date.now();
    const timeDelta = now - lastChangeTime.current;
    const charDelta = newValue.length - previousValue.length;
    const lineDelta = newValue.split('\n').length - previousValue.split('\n').length;

    const isLargeInsert = charDelta > 80 || lineDelta >= 5;
    const isFastInsert = charDelta > 40 && timeDelta < 250;

    if (isLargeInsert || isFastInsert) {
      const violationCount = parseInt(localStorage.getItem('pasteViolationCount') || '0', 10);
      const durations = [30, 60, 120, 300];
      const duration = durations[Math.min(violationCount, durations.length - 1)];
      const cooldownUntil = Date.now() + duration * 1000;

      localStorage.setItem('cooldownUntil', String(cooldownUntil));
      localStorage.setItem('pasteViolationCount', String(violationCount + 1));
      onPasteDetected?.();
    }

    lastChangeTime.current = now;
    latestValue.current = newValue;
  };

  // Building the bridge for Python code to interact with the editor
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    const bridge = (window as any).ideBridge;
    if (!bridge) return;
    // Allows the Python code to understand the current content of the editor
    bridge.getEditorContent = () => latestValue.current;

    // Allows the Python code to delete a character at a specific index in the editor
    bridge.deleteCharacterIndex = (index: number) => {
      // Ensure the editor and its model are available
      if (!editorRef.current) return;
      const model = editorRef.current.getModel();
      if (!model) return;

      // Convert the index to a position in the editor (for monaco needs)
      const position = model.getPositionAt(index);
      const range = new monaco.Range(
        position.lineNumber, position.column,
        position.lineNumber, position.column + 1
      );

      // Removing the character at the specified index (it does not move the cursor!)
      editorRef.current.executeEdits("corruption_logic", [
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
      onChange={(value) => {
        const nextValue = value || "";
        detectPasteLike(nextValue);
        onChange(nextValue);
      }}
      onMount={handleEditorMount}
      options={options}
    />
  );
};

export default CodeEditor;
