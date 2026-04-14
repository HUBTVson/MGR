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
        
        // Show loading message in the UI terminal
        setOutput("Running...\n");
        
        // Variable to collect all stdout (print statements) from Python
        let capturedOutput = "";

        // Redirect Python's stdout to our variable
        pyodide.setStdout({
            batched: (text: string) => {
                capturedOutput += text + "\n";
            }
        });

        try {
            // Run Python code in Pyodide instance
            await pyodide.runPythonAsync(code);
            
            // Update the UI terminal with the captured logs
            // If the code didn't print anything, show a success message
            setOutput(capturedOutput || "Success of the code execution.");
        } catch (err) {
            // Capture and display execution errors (e.g., SyntaxError)
            setOutput(`Error:\n${err}`);
        }
    }

    // Return Pyodide instance, loading state, output, and execute function
    return { pyodide, isLoading, output, runCode };
};