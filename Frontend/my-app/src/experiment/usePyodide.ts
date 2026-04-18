import { useEffect, useState } from 'react';
// Import Python code as string for execution
import randRemoveSignCode from '../experiment/corruption_logic.py?raw';

export const usePyodide = () => {
    // Pyodide runtime instance
    const [pyodide, setPyodide] = useState<any>(null);
    // Loading state while initializing Pyodide
    const [isLoading, setIsLoading] = useState<boolean>(true);
    // Output from Python code execution
    const [output, setOutput] = useState<string>("");
    
    useEffect(() => {
        // Set up global bridge for Python code to call IDE functions
        (window as any).ideBridge = {
            getEditorContent: () => "",
            deleteCharacterIndex: (_index: number) => {},
        };

        // Track if component is still mounted (prevent state updates after unmount)
        let isMounted = true;

        async function initPyodide() {
            // Check if Pyodide is available globally
            if (!(window as any).loadPyodide) {
                console.error("Failed to load Pyodide: window.loadPyodide is undefined.");
                return;
            }

            try {
                // Initialize Pyodide runtime
                const py = await (window as any).loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                });

                // Load and execute the rand remove sign code in the background
                await py.runPythonAsync(randRemoveSignCode);

                // Store instance if component is still mounted
                if (isMounted) {
                    setPyodide(py);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Failed to load Pyodide or rand remove sign script:", err);
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        initPyodide();
        
        return () => { isMounted = false; };
    }, []);

    // Execute Python code and handle errors
    async function runCode(code: string) {
        if (!pyodide) return;
        
        // Clear previous output
        setOutput("");
        
        // Reset prompt input counter for each run
        (window as any).input_counter = 0;

        // Override input() function to use browser prompt dialogs
        pyodide.runPython(`
import builtins
import sys
from io import StringIO
from js import window

def custom_input(prompt=""):
    if not hasattr(window, 'input_counter'):
        window.input_counter = 0
    window.input_counter += 1
    dialog_text = prompt if prompt else f"Input numer {window.input_counter}"
    result = window.prompt(dialog_text)
    if result is None:
        raise EOFError("No input provided")
    return str(result)

builtins.input = custom_input

# Capture stdout
old_stdout = sys.stdout
sys.stdout = captured_stringio = StringIO()
        `);

        try {
            // Run Python code in Pyodide instance
            await pyodide.runPythonAsync(code);
            
            // Get captured output
            const capturedOutput = pyodide.runPython("captured_stringio.getvalue()");
            
            // Restore stdout
            pyodide.runPython("sys.stdout = old_stdout");
            
            // Update output
            setOutput(capturedOutput || "Success of the code execution.");
        } catch (err) {
            // Restore stdout even on error
            pyodide.runPython("sys.stdout = old_stdout");
            
            // Capture and display execution errors (e.g., SyntaxError)
            setOutput(`Error:\n${err}`);
        }
    }

    async function runCodeWithInput(code: string, inputData: string) {
        if (!pyodide) return { success: false, output: '', error: 'Pyodide not loaded.' };

        const inputLines = inputData === '' ? [] : inputData.split('\n');
        const pythonInputList = JSON.stringify(inputLines);

        const wrappedCode = `
import builtins
import sys
from io import StringIO

input_values = ${pythonInputList}
input_index = [0]

def custom_input(prompt=""):
    if input_index[0] >= len(input_values):
        raise EOFError("No more input provided")
    value = input_values[input_index[0]]
    input_index[0] += 1
    return str(value)

builtins.input = custom_input

# Capture stdout
old_stdout = sys.stdout
sys.stdout = captured_stringio = StringIO()

# Execute user code
${code}

# Get captured output
captured_output = captured_stringio.getvalue()

# Restore stdout
sys.stdout = old_stdout
        `;

        try {
            await pyodide.runPythonAsync(wrappedCode);
            const capturedOutput = pyodide.runPython("captured_output");
            return { success: true, output: capturedOutput };
        } catch (err) {
            // Try to get any output even on error
            let capturedOutput = '';
            try {
                capturedOutput = pyodide.runPython("captured_output");
            } catch {}
            return { success: false, output: capturedOutput, error: String(err) };
        }
    }

    // Return Pyodide instance, loading state, output, and execute function
    return { pyodide, isLoading, output, runCode, runCodeWithInput };
};