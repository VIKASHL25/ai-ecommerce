from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from groq import Groq
import os

app = FastAPI(title="AI Chatbot Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "secret")
JWT_ALGORITHM = "HS256"
GROQ_MODEL    = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
bearer_scheme = HTTPBearer(auto_error=False)
groq_api_key  = os.environ.get("GROQ_API_KEY", "")
groq_client   = Groq(api_key=groq_api_key) if groq_api_key else None

# ── System prompt ─────────────────────────────────────────────────
SYSTEM_PROMPT = """You are ShopBot, an intelligent and friendly AI shopping concierge for AI Shop — a high-scale e-commerce marketplace.

You assist customers with:
- Discovering top products across 8 major departments: Electronics, Mobile & Audio, Gaming & Gear, Smart Home, Fashion & Apparel, Sports & Fitness, Books & Knowledge, and Health & Beauty.
- Answering queries about product specifications, pricing, brand details, and compatibility.
- Order tracking, checkout support, and cart navigation.
- Store policies:
  * Free expedited shipping on all orders over $50
  * 30-day hassle-free returns & warranty replacement
  * 24/7 dedicated support via AI & live team
  * Secure instant checkout

Keep answers concise, helpful, and polite (2-4 sentences). Recommend specific categories or products whenever relevant!"""

# ── Auth helper ───────────────────────────────────────────────────
def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    if not credentials:
        return None
    try:
        return jwt.decode(
            credentials.credentials, JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )
    except JWTError:
        return None

# ── Models ────────────────────────────────────────────────────────
class Message(BaseModel):
    role:    str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message:  str
    history:  list[Message] = []

# ── Routes ────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy", "service": "ai-chatbot"}

@app.post("/")
def chat(req: ChatRequest, user=Depends(get_optional_user)):
    user_name = user.get("name", "there") if user else "there"
    
    if not groq_client or not groq_api_key:
        return {
            "reply": f"Hello {user_name}! Welcome to AI Shop. Browse our 80+ catalog across Electronics, Gaming, Smart Home, Fashion, and more. Free shipping applies on all orders above $50!",
            "user": user_name
        }

    # Build message history for context
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history (last 6 messages for context)
    for msg in req.history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})

    # Add current user message
    messages.append({"role": "user", "content": req.message})

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=300,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
        return {
            "reply": reply,
            "user": user_name,
        }
    except Exception as e:
        return {
            "reply": f"Hi {user_name}! I am ShopBot. How can I assist you with our catalog, shipping, or recommendations today?",
            "user": user_name
        }

@app.post("/quick")
def quick_reply(req: ChatRequest):
    """Quick single-turn chat."""
    if not groq_client or not groq_api_key:
        return {"reply": "Welcome to AI Shop! How can I help you find what you need today?"}
    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": req.message}
            ],
            max_tokens=200,
            temperature=0.7,
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        return {"reply": "Welcome to AI Shop! Looking for electronics, gaming gear, smart home or fashion?"}