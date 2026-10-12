from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import mysql.connector
import os
import time

app = FastAPI(title="Auth Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Config
JWT_SECRET    = os.environ.get("JWT_SECRET", "secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE    = 60  # minutes
pwd_ctx       = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

# ── Database
def get_db():
    for attempt in range(30):
        try:
            conn = mysql.connector.connect(
                host=os.environ.get("MYSQL_HOST", "mysql"),
                user=os.environ.get("MYSQL_USER", "root"),
                password=os.environ.get("MYSQL_PASSWORD", "rootpassword"),
                database=os.environ.get("MYSQL_DB", "ecommerce")
            )
            return conn
        except Exception as e:
            print(f"Attempt {attempt+1}/30: DB not ready — {e}")
            time.sleep(3)
    raise HTTPException(500, "Database connection failed")

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            name        VARCHAR(100) NOT NULL,
            email       VARCHAR(100) UNIQUE NOT NULL,
            password    VARCHAR(255) NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Users table ready")

# ── Startup
@app.on_event("startup")
async def startup():
    time.sleep(5)
    init_db()

# ── Helpers
def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE)
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

# ── Models ────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# ── Routes
@app.get("/health")
def health():
    return {"status": "healthy", "service": "auth"}

@app.post("/register")
def register(req: RegisterRequest):
    conn = get_db()
    cursor = conn.cursor()
    # Check if email already exists
    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cursor.fetchone():
        cursor.close(); conn.close()
        raise HTTPException(400, "Email already registered")
    # Insert new user
    hashed = hash_password(req.password)
    cursor.execute(
        "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
        (req.name, req.email, hashed)
    )
    conn.commit()
    user_id = cursor.lastrowid
    cursor.close(); conn.close()
    token = create_token({"user_id": user_id, "email": req.email, "name": req.name})
    return {
        "message": "Registration successful!",
        "token": token,
        "user": {"id": user_id, "name": req.name, "email": req.email}
    }

@app.post("/login")
def login(req: LoginRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, name, email, password FROM users WHERE email = %s",
        (req.email,)
    )
    user = cursor.fetchone()
    cursor.close(); conn.close()
    if not user or not verify_password(req.password, user[3]):
        raise HTTPException(401, "Invalid email or password")
    token = create_token({"user_id": user[0], "email": user[2], "name": user[1]})
    return {
        "message": "Login successful!",
        "token": token,
        "user": {"id": user[0], "name": user[1], "email": user[2]}
    }

@app.get("/me")
def get_me(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    payload = decode_token(credentials.credentials)
    return {
        "user_id": payload.get("user_id"),
        "name":    payload.get("name"),
        "email":   payload.get("email")
    }

@app.get("/verify")
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    payload = decode_token(credentials.credentials)
    return {"valid": True, "user_id": payload.get("user_id"),
            "email": payload.get("email")}