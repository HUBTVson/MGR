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

# Storing cooldownu per user
user_cooldowns = {}
COOLDOWN_DURATIONS = [30, 60, 120, 300] 


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

if __name__ == "__main__":
    import uvicorn
    print("Backend running on http://localhost:3001")
    print("Docs available at http://localhost:3001/docs")
    uvicorn.run(app, host="0.0.0.0", port=3001)

