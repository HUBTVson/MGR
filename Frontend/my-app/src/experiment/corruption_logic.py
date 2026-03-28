import js
import random

# DEBUGGING REASON
js.console.log("Rand remove sign logic has been initialized!")

# Define the limit of signs that cannot be corrupted because of 
# destroying the proposed piece of code for the user
CORRUPTION_LIMIT = 50

def start_rand_remove_sign(min_time_ms=40000, max_time_ms=60000):
    js.console.log(f"Starting rand remove sign with interval {min_time_ms}-{max_time_ms}ms")
    
    # Define the corruption step as an inner function so it has access to parameters
    def do_rand_remove_sign():
        try:
            bridge = js.ideBridge
            current_content = bridge.getEditorContent()
            
            # Adust the corruption limit based on the content length
            if current_content and len(current_content) > CORRUPTION_LIMIT:
                # Random index within valid range
                idx = random.randint(CORRUPTION_LIMIT, len(current_content) - 1)
                
                js.console.log(f"Removed random sign at index {idx}.")
                
                # Remove the character
                if hasattr(bridge, 'deleteCharacterIndex'):
                    bridge.deleteCharacterIndex(idx)
            
            # Schedule next corruption using eval to avoid proxy issues - without it the function reference was unable to be called from JS
            next_run = random.randint(min_time_ms, max_time_ms)
            js.eval(f"setTimeout(() => window.doRandRemoveSignStep(), {next_run})")
        except Exception as e:
            js.console.error(f"Error in rand remove sign: {type(e).__name__}: {e}")
    
    # Store the function globally so JS can call it
    js.window.doRandRemoveSignStep = do_rand_remove_sign
    
    # Start the cycle
    do_rand_remove_sign()

# Expose to JS
js.startRandRemoveSign = start_rand_remove_sign