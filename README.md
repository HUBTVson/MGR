# Malicious Programming Environment — MGR

Aplikacja webowa została przygotowana jako aparatura badawcza na potrzeby pracy magisterskiej.
Umożliwia badanym rozwiązywanie zadań programistycznych w języku Python w specjalnie przygotowanym środowisku.
Podczas pracy aplikacja wprowadza kontrolowane utrudnienia mające na celu wywoływanie frustracji oraz rejestruje przebieg badania.
System składa się z frontendu React oraz backendu FastAPI odpowiedzialnego m.in. Za konfigurację badania, zadania, logi i zapis nagrań.

## Uruchomienie

### 1. Pobranie projektu

```bash
git clone https://github.com/HUBTVson/MGR.git
cd MGR
```

### 2. Uruchomienie backendu

W pierwszym terminalu:

```bash
cd Backend
python -m pip install -r requirements.txt
python backend.py
```

Backend zostanie uruchomiony pod adresem:

```text
http://localhost:3001
```

### 3. Uruchomienie frontendu

W drugim terminalu, znajdując się w głównym katalogu projektu:

```bash
cd Frontend/my-app
npm install
npm run dev
```

Frontend będzie dostępny pod adresem wyświetlonym w terminalu, domyślnie:

```text
http://localhost:5173
```
