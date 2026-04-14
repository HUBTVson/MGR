import js
import random

# DEBUGGING REASON
js.console.log("Rand remove sign logic has been initialized!")

# Define the limit of signs that cannot be corrupted because of 
# destroying the proposed piece of code for the user
CORRUPTION_LIMIT = 50

# Markers to define corruption zones
CORRUPTION_START = "# Write your code below"
CORRUPTION_END = "# End of file"

def find_corruption_ranges(content):
    """
    Find ranges between # CORRUPTION_START and # CORRUPTION_END markers.
    Returns list of (start, end) tuples where corruption is allowed.
    """
    ranges = []
    lines = content.split('\n')
    in_range = False
    start_idx = 0
    
    for i, line in enumerate(lines):
        if CORRUPTION_START in line and not in_range:
            in_range = True
            # Start index: position after the marker line
            start_idx = sum(len(lines[j]) + 1 for j in range(i + 1))  # +1 for \n
        elif CORRUPTION_END in line and in_range:
            in_range = False
            # End index: position before the marker line
            end_idx = sum(len(lines[j]) + 1 for j in range(i))
            if start_idx < end_idx:
                ranges.append((start_idx, end_idx - 1))  # -1 to exclude the end marker line
    
    return ranges

def start_rand_remove_sign(min_time_ms=40000, max_time_ms=60000):
    js.console.log(f"Starting rand remove sign with interval {min_time_ms}-{max_time_ms}ms")
    
    # Define the corruption step as an inner function so it has access to parameters
    def do_rand_remove_sign():
        try:
            bridge = js.ideBridge
            current_content = bridge.getEditorContent()
            
            if not current_content or len(current_content) <= CORRUPTION_LIMIT:
                # Schedule next corruption
                next_run = random.randint(min_time_ms, max_time_ms)
                js.eval(f"setTimeout(() => window.doRandRemoveSignStep(), {next_run})")
                return
            
            # Find corruption ranges
            ranges = find_corruption_ranges(current_content)
            
            if not ranges:
                # No markers found: disable corruption completely
                js.console.log("No corruption markers found - corruption disabled.")
                # Schedule next corruption (but it will check again)
                next_run = random.randint(min_time_ms, max_time_ms)
                js.eval(f"setTimeout(() => window.doRandRemoveSignStep(), {next_run})")
                return
            
            # Pick a random range
            start, end = random.choice(ranges)
            if start < end:
                idx = random.randint(start, end)
            else:
                # Schedule next corruption
                next_run = random.randint(min_time_ms, max_time_ms)
                js.eval(f"setTimeout(() => window.doRandRemoveSignStep(), {next_run})")
                return
            
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