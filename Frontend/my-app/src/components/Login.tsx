import React, { useState } from 'react';

interface LoginProps {
  onLogin: (userCode: string, isAdmin: boolean) => void;
}

const adminCodes = [
  '189039',
  '189423',
];

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const validateCode = (value: string) => {
    if (!/^[0-9]*$/.test(value)) {
      return 'Podaj tylko cyfry.';
    }
    if (value.length > 6) {
      return 'Index powinien mieć 6 cyfr.';
    }
    return '';
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = code.trim();
    const validationError = validateCode(trimmed);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmed.length !== 6) {
      setError('Podaj dokładnie 6 cyfr.');
      return;
    }

    setError('');
    const isAdmin = adminCodes.includes(trimmed);
    onLogin(trimmed, isAdmin);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e1e1e', color: '#fff' }}>
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 24, borderRadius: 8, background: '#2a2a2a', boxShadow: '0 0 12px rgba(0,0,0,0.4)' }}>
        <h2 style={{ marginBottom: 6, textAlign: 'center' }}>Logowanie</h2>

        <label htmlFor="userCode" style={{ display: 'block', textAlign: 'center', marginBottom: 6 }}>
          Twój index:
        </label>

        <input
          id="userCode"
          value={code}
          onChange={(e) => {
            const value = e.target.value;
            const validationError = validateCode(value);
            setCode(value);
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

        {error && <div style={{ color: '#ff6b6b', marginTop: 10 }}>{error}</div>}

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
