// Code Editor has access to the newest text (code) history.
// Its task is to connect his "skills" with the already created bridge (window.ideBridge).

import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  defaultLanguage?: string;
  theme?: string;
  options?: any;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  height = "100%",
  options = { fontSize: 14, minimap: { enabled: false } }
}) => {

  // editorRef defines a reference to the Monaco Editor instance, allowing direct access
  //  to editor methods and properties. (exact localization of our editor)
  const editorRef = React.useRef<any>(null);
  // latestValue is a reference that holds the most recent value of the editor's content.
  const latestValue = React.useRef(value);

  // Actualization of the latestValue 
  React.useEffect(() => {
    latestValue.current = value;
  }, [value]);

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
      onChange={(value) => onChange(value || "")}
      onMount={handleEditorMount}
      options={options}
    />
  );
};

export default CodeEditor;
