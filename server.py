import os
import shutil
import secrets
import db
from typing import List, Dict, Optional
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pydantic import BaseModel
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from starlette.middleware.sessions import SessionMiddleware
try:
    from authlib.integrations.starlette_client import OAuth
except ModuleNotFoundError as e:
    raise RuntimeError(
        f"Missing dependency required for OAuth integration: {e}. "
        "Make sure dependencies are installed (e.g., add httpx to requirements.txt)."
    ) from e

os.makedirs("uploads", exist_ok=True)

app = FastAPI(title="Free Fire Malaysia Customer Service API")

SESSION_SECRET = os.getenv("SESSION_SECRET", "ffmy-dev-session-secret-change-me")

app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax", https_only=False)

oauth = OAuth()

if os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"):
    oauth.register(
        name="google",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if os.getenv("FACEBOOK_APP_ID") and os.getenv("FACEBOOK_APP_SECRET"):
    oauth.register(
        name="facebook",
        client_id=os.getenv("FACEBOOK_APP_ID"),
        client_secret=os.getenv("FACEBOOK_APP_SECRET"),
        access_token_url="https://graph.facebook.com/oauth/access_token",
        authorize_url="https://www.facebook.com/dialog/oauth",
        api_base_url="https://graph.facebook.com/",
        client_kwargs={"scope": "email public_profile"},
    )

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, ticket_id: str, websocket: WebSocket):
        await websocket.accept()
        if ticket_id not in self.active_connections:
            self.active_connections[ticket_id] = []
        self.active_connections[ticket_id].append(websocket)

    def disconnect(self, ticket_id: str, websocket: WebSocket):
        if ticket_id in self.active_connections:
            if websocket in self.active_connections[ticket_id]:
                self.active_connections[ticket_id].remove(websocket)
            if not self.active_connections[ticket_id]:
                del self.active_connections[ticket_id]

    async def broadcast(self, ticket_id: str, message: dict):
        if ticket_id in self.active_connections:
            for connection in list(self.active_connections[ticket_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(ticket_id, connection)

ws_manager = ConnectionManager()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBasic()

def get_current_admin(credentials: HTTPBasicCredentials = Depends(security)):
    admin_user = os.getenv("ADMIN_USER", "admin")
    admin_pass = os.getenv("ADMIN_PASS", "admin123")
    
    correct_username = secrets.compare_digest(credentials.username, admin_user)
    correct_password = secrets.compare_digest(credentials.password, admin_pass)
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access denied.",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@app.get("/dashboard")
async def dashboard():
    return RedirectResponse(url="/dashboard.html")


class StatusUpdate(BaseModel):
    status: str


def get_session_user(request: Request):
    return request.session.get("user")


def require_session_user(request: Request):
    user = get_session_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Please log in first.")
    return user


@app.get("/api/current_user")
async def current_user(request: Request):
    user = get_session_user(request)
    return user if user else None


@app.get("/auth/google")
async def auth_google(request: Request):
    if not (os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET")):
        raise HTTPException(status_code=503, detail="Google login is not configured.")
    redirect_uri = request.url_for("auth_google_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/auth/google/callback", name="auth_google_callback")
async def auth_google_callback(request: Request):
    if not (os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET")):
        return RedirectResponse(url="/?error=login_failed")
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        if not user_info:
            user_info = await oauth.google.parse_id_token(request, token)

        user = db.find_or_create_oauth_user(
            provider="google",
            provider_id=user_info["sub"],
            name=user_info.get("name"),
            email=user_info.get("email"),
        )
        request.session["user"] = db.serialize_user(user)
        return RedirectResponse(url="/")
    except Exception as err:
        print(f"Google auth error: {err}")
        return RedirectResponse(url="/?error=login_failed")


@app.get("/auth/facebook")
async def auth_facebook(request: Request):
    if not (os.getenv("FACEBOOK_APP_ID") and os.getenv("FACEBOOK_APP_SECRET")):
        raise HTTPException(status_code=503, detail="Facebook login is not configured.")
    redirect_uri = request.url_for("auth_facebook_callback")
    return await oauth.facebook.authorize_redirect(request, redirect_uri)


@app.get("/auth/facebook/callback", name="auth_facebook_callback")
async def auth_facebook_callback(request: Request):
    if not (os.getenv("FACEBOOK_APP_ID") and os.getenv("FACEBOOK_APP_SECRET")):
        return RedirectResponse(url="/?error=login_failed")
    try:
        token = await oauth.facebook.authorize_access_token(request)
        resp = await oauth.facebook.get("me?fields=id,name,email", token=token)
        profile = resp.json()

        user = db.find_or_create_oauth_user(
            provider="facebook",
            provider_id=profile["id"],
            name=profile.get("name"),
            email=profile.get("email"),
        )
        request.session["user"] = db.serialize_user(user)
        return RedirectResponse(url="/")
    except Exception as err:
        print(f"Facebook auth error: {err}")
        return RedirectResponse(url="/?error=login_failed")


@app.get("/auth/logout")
async def auth_logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/")


@app.get("/home")
async def home_redirect():
    return RedirectResponse(url="/")


@app.post("/api/ticket")
@app.post("/api/tickets")
async def create_new_ticket(
    request: Request,
    uid: str = Form(...),
    nickname: str = Form(...),
    request_type: str = Form(...),
    description: str = Form(...),
    privacy_policy: bool = Form(...),
    ban_screenshot: bool = Form(False),
    files: List[UploadFile] = File(None)
):
    session_user = require_session_user(request)
    if not uid.isdigit():
        raise HTTPException(status_code=400, detail="Account UID must be numbers only.")
        
    if not nickname.strip():
        raise HTTPException(status_code=400, detail="Nickname cannot be empty.")
        
    if request_type not in ["ban_appeal", "bug_report", "feedback", "general_inquiry", "technical_issue"]:
        raise HTTPException(status_code=400, detail="Invalid request type.")
        
    if not privacy_policy:
        raise HTTPException(status_code=400, detail="You must agree to the Privacy Policy.")
        
    if request_type == "ban_appeal" and not ban_screenshot:
        raise HTTPException(status_code=400, detail="Ban appeal requires a screenshot as proof.")

    total_size = 0
    
    if files and len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 files allowed.")

    actual_files = files if files else []
    for file in actual_files:
        if not file.filename:
            continue
            
        await file.seek(0, 2)
        file_size = await file.tell()
        await file.seek(0)
        
        total_size += file_size

        is_video = file.content_type.startswith("video/")
        limit = 30 * 1024 * 1024 if is_video else 10 * 1024 * 1024
        limit_str = "30MB" if is_video else "10MB"
        
        if file_size > limit:
            raise HTTPException(status_code=400, detail=f"File size for {file.filename} exceeds the {limit_str} limit.")
            
    if total_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Total size of all files exceeds the 50MB limit.")

    try:
        attachments_meta = []

        temp_ticket = db.create_ticket(
            uid=uid,
            nickname=nickname,
            request_type=request_type,
            description=description,
            privacy_policy_accepted=privacy_policy,
            ban_screenshot_accepted=ban_screenshot,
            attachments=[],
            user_id=session_user["id"],
            user_email=session_user.get("email"),
        )
        
        ticket_id = temp_ticket["ticket_id"]
        
        ticket_upload_dir = os.path.join("uploads", ticket_id)
        os.makedirs(ticket_upload_dir, exist_ok=True)

        actual_files = files if files else []
        for file in actual_files:
            if not file.filename:
                continue
            
            file_path = os.path.join(ticket_upload_dir, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            attachments_meta.append({
                "filename": file.filename,
                "path": f"/uploads/{ticket_id}/{file.filename}",
                "size": os.path.getsize(file_path),
                "mime_type": file.content_type
            })
            
        if attachments_meta:
            db.update_ticket_attachments(ticket_id, attachments_meta)
            temp_ticket["attachments"] = attachments_meta
            
        try:
            db.sync_to_mysql(temp_ticket)
            print(f"Ticket {ticket_id} synced to MySQL successfully.")
        except Exception as sync_err:
            print(f"MySQL Sync Error: {sync_err}")

        return temp_ticket
        
    except Exception as e:
        print(f"Error creating ticket: {e}")
        raise HTTPException(status_code=500, detail="System error while creating ticket. Please try again shortly.")

@app.get("/api/my-tickets")
async def get_my_tickets_for_user(request: Request):
    session_user = require_session_user(request)
    try:
        return db.get_tickets_by_user_id(session_user["id"])
    except Exception as e:
        print(f"Error retrieving tickets for user {session_user['id']}: {e}")
        raise HTTPException(status_code=500, detail="Database system error.")


@app.get("/api/tickets", dependencies=[Depends(get_current_admin)])
async def get_tickets_list(status: str = None, admin: str = Depends(get_current_admin)):
    try:
        return db.get_all_tickets(status=status)
    except Exception as e:
        print(f"Error retrieving tickets: {e}")
        return []

@app.get("/api/ticket/{ticket_id}")
@app.get("/api/tickets/{ticket_id}")
def get_ticket_details(ticket_id: str):
    try:
        ticket = db.get_ticket(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        return ticket
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error retrieving ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Database system error.")

@app.get("/api/my-tickets/{uid}")
def get_my_tickets(uid: str):
    try:
        tickets = db.get_tickets_by_uid(uid)
        return tickets
    except Exception as e:
        print(f"Error retrieving tickets for UID {uid}: {e}")
        raise HTTPException(status_code=500, detail="Database system error.")

@app.put("/api/ticket/{ticket_id}/status")
@app.put("/api/tickets/{ticket_id}/status")
async def update_status(ticket_id: str, status_data: StatusUpdate, admin: str = Depends(get_current_admin)):
    try:
        if status_data.status not in ["Open", "Solved"]:
            raise HTTPException(status_code=400, detail="Invalid status.")
            
        success = db.update_ticket_status(ticket_id, status_data.status)
        if not success:
            raise HTTPException(status_code=404, detail="Failed to update ticket or ticket not found.")
            
        await ws_manager.broadcast(ticket_id, {
            "type": "status_update",
            "status": status_data.status
        })
        
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating status: {e}")
        raise HTTPException(status_code=500, detail="System error while changing status.")

@app.delete("/api/ticket/{ticket_id}", dependencies=[Depends(get_current_admin)])
@app.delete("/api/tickets/{ticket_id}", dependencies=[Depends(get_current_admin)])
async def delete_ticket_api(ticket_id: str, admin: str = Depends(get_current_admin)):
    try:
        success = db.delete_ticket(ticket_id)
        if not success:
            raise HTTPException(status_code=404, detail="Ticket not found or already deleted.")
        
        return {"status": "success", "message": f"Ticket {ticket_id} deleted successfully."}
    except Exception as e:
        print(f"Error deleting ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="System error while deleting ticket.")


@app.websocket("/ws/ticket/{ticket_id}")
async def websocket_endpoint(websocket: WebSocket, ticket_id: str):
    ticket = db.get_ticket(ticket_id)
    if not ticket:
        await websocket.close(code=4000)
        return

    await ws_manager.connect(ticket_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            sender = data.get("sender")
            text = data.get("text", "").strip()
            
            if sender not in ["user", "admin"] or not text:
                continue

            updated_ticket = db.add_message_to_ticket(ticket_id, sender, text)
            
            now = datetime.utcnow().isoformat() + "Z"
            await ws_manager.broadcast(ticket_id, {
                "type": "message",
                "sender": sender,
                "text": text,
                "timestamp": now
            })
            
    except WebSocketDisconnect:
        ws_manager.disconnect(ticket_id, websocket)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        ws_manager.disconnect(ticket_id, websocket)


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
if os.path.exists("public"):
    app.mount("/", StaticFiles(directory="public", html=True), name="public")
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)