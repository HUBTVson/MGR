"""
BACKEND - Python + FastAPI

Install:
    pip install fastapi uvicorn python-multipart
    python -m pip install -r requirements.txt

Run:
    uvicorn backend:app --host 0.0.0.0 --port 3001 --reload

Endpoint: POST /api/check-cooldown
Body: { "userId": "189039" }
Response: { "allowed": true/false, "timeRemaining": number }

Docs: http://localhost:3001/docs
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import time, os
import json

app = FastAPI(title="Paste Detection Backend", version="1.0.0")

# CORS (Cross-Origin Resource Sharing) middleware
# It allows the web browser to grant permitted domains access to API resources
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_config():
    with open('config.json', 'r', encoding='utf-8') as f:
        return json.load(f)

# Storing cooldownu per user
user_cooldowns = {}

config = load_config()

ADMIN_CODES = set(config['admin_codes'])
COOLDOWN_DURATIONS = config['cooldown_durations']
CORRUPTION_SETTINGS = config['corruption']


class CheckCooldownRequest(BaseModel):
    userId: str
    isAdmin: bool = False


class CheckCooldownResponse(BaseModel):
    allowed: bool
    timeRemaining: int = 0
    violationCount: int = 0


class RecordPasteRequest(BaseModel):
    userId: str
    isAdmin: bool = False


class RecordPasteResponse(BaseModel):
    success: bool
    cooldownUntil: int
    violationCount: int
    duration: int


class ResetPasteRequest(BaseModel):
    userId: str

class AdminVerifyRequest(BaseModel):
    code: str

@app.post("/api/check-cooldown", response_model=CheckCooldownResponse)
async def check_cooldown(request: CheckCooldownRequest):
    """Sprawdza, czy użytkownik może uruchomić kod."""
    user_id = request.userId

    if not user_id:
        raise HTTPException(status_code=400, detail="userId required")

    # Admins are not subject to cooldown functionality
    if request.isAdmin:
        return CheckCooldownResponse(allowed=True)

    now = time.time() * 1000  # (ms)
    user_data = user_cooldowns.get(user_id)

    # Cooldown is acitve
    if user_data and now < user_data['cooldownUntil']:
        time_remaining = (user_data['cooldownUntil'] - now) / 1000
        return CheckCooldownResponse(
            allowed=False,
            timeRemaining=int(time_remaining),
            violationCount=user_data['violationCount']
        )

    # Cooldown is NOT active
    return CheckCooldownResponse(allowed=True)


@app.post("/api/record-paste", response_model=RecordPasteResponse)
async def record_paste(request: RecordPasteRequest):
    """Rejestruje naruszenie (wklejenie). Wywoływane, gdy backend wykrywa oszustwo."""
    user_id = request.userId

    if not user_id:
        raise HTTPException(status_code=400, detail="userId required")

    # Admins are exempt from cooldown
    if request.isAdmin:
        return RecordPasteResponse(
            success=True,
            cooldownUntil=0,
            violationCount=0,
            duration=0
        )

    print(f"DEBUG: Otrzymano żądanie kary dla: {request.userId}")
    user_data = user_cooldowns.get(user_id, {'violationCount': 0})
    violation_count = user_data['violationCount'] + 1
    duration = COOLDOWN_DURATIONS[min(violation_count - 1, len(COOLDOWN_DURATIONS) - 1)]

    now = time.time() * 1000  # (ms)
    cooldown_until = now + duration * 1000

    user_cooldowns[user_id] = {
        'cooldownUntil': cooldown_until,
        'violationCount': violation_count,
        'lastViolation': datetime.now().isoformat()
    }

    print(f"User {user_id}: paste violation #{violation_count}, cooldown {duration}s")

    return RecordPasteResponse(
        success=True,
        cooldownUntil=int(cooldown_until),
        violationCount=violation_count,
        duration=duration
    )


@app.post("/api/reset-paste-count")
async def reset_paste_count(request: ResetPasteRequest):
    """Reset naruszenia (dla admina lub manual reset)."""
    user_id = request.userId

    if user_id in user_cooldowns:
        del user_cooldowns[user_id]
        print(f"User {user_id}: paste count reset")

    return {"success": True}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}

RECORDINGS_DIR = "recordings"

@app.post("/api/upload")
async def upload_recording(
    file: UploadFile = File(...),
    userId: str = Form(...),
    sessionId: str = Form(...),
    type: str = Form(...),
):
    if type not in ("face", "screen"):
        raise HTTPException(status_code=400, detail="type must be 'face' or 'screen'")
    
    user_dir = os.path.join(RECORDINGS_DIR, f"user_{userId}")
    os.makedirs(user_dir, exist_ok=True)
    
    filepath = os.path.join(user_dir, f"{sessionId}_{type}.webm")
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
        
    return {"success": True, "path": filepath}

# Wczytywanie zadań z pliku
def load_tasks_from_json():
    with open('tasks.json', 'r', encoding='utf-8') as f:
        return json.load(f)

@app.get("/api/tasks")
async def get_tasks():
    """Zwraca listę zadań bez skryptu asercji"""
    tasks = load_tasks_from_json()
    return [{k: v for k, v in t.items() if k != "test_script"} for t in tasks]

@app.get("/api/tasks/{task_id}/test-script")
async def get_test_script(task_id: int):
    """Zwraca skrypt asercji dla konkretnego zadania."""
    tasks = load_tasks_from_json()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Zadanie nie istnieje")
    
    # Zwracamy tylko skrypt testujący
    return {"test_script": task.get("test_script", "")}

@app.post("/api/verify-admin")
async def verify_admin(request: AdminVerifyRequest):
    user_code = request.code
    
    if user_code in ADMIN_CODES:
        print(f"Admin access granted for code: {user_code}")
        return {"isAdmin": True, "message": "Dostęp przyznany"}
    
    return {"isAdmin": False, "message": "Kod nie admina"}

@app.get("/api/thresholds")
async def get_thresholds():
    return config["detection_thresholds"]

@app.get("/api/corruption")
async def get_corruption():
    return config["corruption"]

@app.get("/api/freeze-config")
async def get_freeze_config():
    return config.get("freeze", {"min_ms": 0, "max_ms": 0, "chance": 0})

@app.get("/api/syntax-config")
async def get_syntax_config():
    return {
        "syntax_keywords": config.get("syntax_keywords", {
            "words": ["class", "def"],
            "count": 30
        }),
        "perturbation_count": config.get("peturbation_count", 40), 
        "swap_count": config.get("swap_count", 60)
    }

if __name__ == "__main__":
    import uvicorn
    print("Backend running on http://localhost:3001")
    print("Docs available at http://localhost:3001/docs")
    uvicorn.run(app, host="0.0.0.0", port=3001)

