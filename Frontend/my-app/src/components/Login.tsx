import React, { useState } from 'react';

// Props interface for the Login component
interface LoginProps {
  onLogin: (userCode: string, isAdmin: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateCode = (value: string) => {
    if (!/^[0-9]*$/.test(value)) {
      return 'Podaj tylko cyfry.';
    }
    if (value.length > 6) {
      return 'Index powinien mieć 6 cyfr.';
    }
    return '';
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
    setIsLoading(true);

    try {
      const response = await fetch('/api/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await response.json();
      onLogin(trimmed, data.isAdmin || false); 
    } catch (err) {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e1e1e', color: '#fff', flexDirection: 'column' }}>
      
      {/* OKIENKO INFORMACYJNE */}
      <div style={{ width: 420, padding: 20, borderRadius: 8, background: '#2a2a2a', boxShadow: '0 0 12px rgba(0,0,0,0.4)', marginBottom: 40, border: '1px solid #3a3a3a' }}>
        <h3 style={{ marginTop: 0, color: '#4CAF50', fontSize: 24 }}>Informacje zanim rozpoczniesz</h3>
        <p style={{ margin: 0, fontSize: 16, lineHeight: '1.5', color: '#ccc' }}>
          Cześć! Mamy dla Ciebie kilka zadań programistycznych. 
          Postaraj się wykonać je samodzielnie - po zakończeniu zadania będziesz mógł przejść do następnego, ale powrót do poprzednich zadań nie będzie możliwy.
          Po dwóch minutach od rozpoczęcia zadania odblokuje się możliwość pominęcia go i przejścia do kolejnego, ale postaraj się korzystać z tej opcji tylko w ostateczności. <br />
          <b>Informujemy, że do podejścia do badania wymagana jest włączona kamera</b> - nagrania z kamery oraz nagrania ekranu zostaną poddane analizie. <br />Z góry dziękujemy za Twój czas i życzymy powodzenia!
        </p>
      </div>

      {/* FORMULARZ LOGOWANIA */}
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 24, borderRadius: 8, background: '#2a2a2a', boxShadow: '0 0 12px rgba(0,0,0,0.4)' }}>
        <h2 style={{ marginBottom: 6, textAlign: 'center' }}>Logowanie</h2>

        <label htmlFor="userCode" style={{ display: 'block', textAlign: 'center', marginBottom: 6 }}>
          Twój index studenta:
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
          disabled={isLoading}
          style={{
            marginTop: 16,
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
          {isLoading ? 'Sprawdzanie...' : 'Rozpocznij'}
        </button>
      </form>
    </div>
  );
};

export default Login;