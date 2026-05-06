import { useEffect, useState } from 'react';
import { ENABLE_FREEZE, applyRandomFreeze } from '../experiment/freeze';

export const usePyodide = (isAdmin: boolean = false, enableFreeze: boolean = false) => {
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
            
            // Freeze main thread AFTER execution, BEFORE showing result
            if (ENABLE_FREEZE && enableFreeze && !isAdmin) {
                applyRandomFreeze();
            }

            // Update the UI terminal with the captured logs
            // If the code didn't print anything, show a success message
          
            // Get captured output
            const capturedOutput = pyodide.runPython("captured_stringio.getvalue()");
            
            // Restore stdout
            pyodide.runPython("sys.stdout = old_stdout");
            
            // Update output
            setOutput(capturedOutput || "Success of the code execution.");

            return { success: true, output: capturedOutput, error: null };
        } catch (err) {
            // Restore stdout even on error
            pyodide.runPython("sys.stdout = old_stdout");
            
            // Capture and display execution errors (e.g., SyntaxError)
            const errorMessage = String(err);
            setOutput(`Error:\n${errorMessage}`);
            
            return { success: false, output: "", error: errorMessage };
        }
    }

    

    // Return Pyodide instance, loading state, output, and execute function
    return { pyodide, isLoading, output, runCode };
};