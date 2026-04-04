import React, { useState } from 'react';

// Props interface for the Login component
// onLogin callback is called when user successfully enters a 6-digit index
interface LoginProps {
  onLogin: (userCode: string, isAdmin: boolean) => void;
}

// List of indexes that grant admin access
const adminCodes = [
  '189039',
  '189423',
];

// Main Login component - displays a 6-digit code input form
const Login: React.FC<LoginProps> = ({ onLogin }) => {
  // State for storing the user input code (0-6 digits)
  const [code, setCode] = useState('');
  // State for displaying validation error messages
  const [error, setError] = useState('');

  // Validates user input: must be only digits and maximum 6 characters long
  const validateCode = (value: string) => {
    // Check if input contains only numbers
    if (!/^[0-9]*$/.test(value)) {
      return 'Podaj tylko cyfry.';
    }
    // Check if input doesn't exceed 6 digits
    if (value.length > 6) {
      return 'Index powinien mieć 6 cyfr.';
    }
    return '';
  };

  // Handles form submission - validates the code and triggers login callback
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Remove whitespace from code input
    const trimmed = code.trim();
    // Validate the input
    const validationError = validateCode(trimmed);

    if (validationError) {
      setError(validationError);
      return;
    }

    // Check that code is exactly 6 digits
    if (trimmed.length !== 6) {
      setError('Podaj dokładnie 6 cyfr.');
      return;
    }

    setError('');
    // Determine if the entered code belongs to an admin
    const isAdmin = adminCodes.includes(trimmed);
    // Call parent component's login handler with user code and admin status
    onLogin(trimmed, isAdmin);
  };

  // Render login form centered on the screen
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e1e1e', color: '#fff' }}>
      {/* Login form container with dark theme styling */}
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 24, borderRadius: 8, background: '#2a2a2a', boxShadow: '0 0 12px rgba(0,0,0,0.4)' }}>
        {/* Form title */}
        <h2 style={{ marginBottom: 6, textAlign: 'center' }}>Logowanie</h2>

        {/* Label for the code input field */}
        <label htmlFor="userCode" style={{ display: 'block', textAlign: 'center', marginBottom: 6 }}>
          Twój index:
        </label>

        {/* Input field for 6-digit user code */}
        <input
          id="userCode"
          value={code}
          onChange={(e) => {
            const value = e.target.value;
            const validationError = validateCode(value);
            setCode(value);
            // Update error message in real time as user types
            if (validationError) {
              setError(validationError);
            } else {
              setError('');
            }
          }}
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 4, border: '1px solid #555', background: '#1f1f1f', color: '#fff', boxSizing: 'border-box' }}
        />

        {/* Display validation error message if any error occurred */}
        {error && <div style={{ color: '#ff6b6b', marginTop: 10 }}>{error}</div>}

        {/* Submit button to login */}
        <button
          type="submit"
          style={{
            marginTop: 16,
            marginBottom: 16,
            marginLeft: 'auto',
            marginRight: 'auto',
            display: 'block',
            width: '100%',
            padding: 10,
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        >
          Zaloguj
        </button>

        
      </form>
    </div>
  );
};

export default Login;
