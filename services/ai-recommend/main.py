from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from groq import Groq
from bson import ObjectId
import pymongo
import os
import time
import json

app = FastAPI(title="AI Recommend Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "secret")
JWT_ALGORITHM = "HS256"
GROQ_MODEL    = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
bearer_scheme = HTTPBearer(auto_error=False)
groq_api_key  = os.environ.get("GROQ_API_KEY", "")
groq_client   = Groq(api_key=groq_api_key) if groq_api_key else None

# ── Database ──────────────────────────────────────────────────────
def get_db():
    for attempt in range(30):
        try:
            client = pymongo.MongoClient(
                host=os.environ.get("MONGO_HOST", "mongodb"),
                port=27017,
                username=os.environ.get("MONGO_USER", "root"),
                password=os.environ.get("MONGO_PASSWORD", "rootpassword"),
                serverSelectionTimeoutMS=3000
            )
            client.server_info()
            return client[os.environ.get("MONGO_DB", "ecommerce")]
        except Exception as e:
            print(f"Attempt {attempt+1}/30: {e}")
            time.sleep(3)
    raise HTTPException(500, "Database connection failed")

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
class RecommendRequest(BaseModel):
    product_id:     str | None = None
    category:       str | None = None
    user_interests: list[str] = []
    budget:         float | None = None
    limit:          int = 4

# ── Helper ────────────────────────────────────────────────────────
def serialize(p):
    p["id"] = str(p.pop("_id"))
    return p

# ── Routes ────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy", "service": "ai-recommend"}

@app.post("/")
def get_recommendations(
    req: RecommendRequest,
    user=Depends(get_optional_user)
):
    db = get_db()

    # Pre-select targeted candidate pool for scale
    viewing_context = ""
    candidate_filter = {}
    current_category = req.category

    if req.product_id:
        try:
            viewed = db.products.find_one({"_id": ObjectId(req.product_id)})
            if viewed:
                viewing_context = f"Currently viewing: {viewed['name']} (${viewed['price']}, {viewed.get('category')})"
                if not current_category:
                    current_category = viewed.get("category")
        except Exception:
            pass

    # Gather category-specific candidates + top-rated cross-category candidates
    candidates = []
    if current_category:
        cat_matches = list(db.products.find({"category": current_category}).limit(15))
        candidates.extend(cat_matches)

    existing_ids = {c["_id"] for c in candidates}
    top_rated = list(db.products.find({"_id": {"$nin": list(existing_ids)}}).sort("rating", -1).limit(25 - len(candidates)))
    candidates.extend(top_rated)

    all_products = [serialize(p) for p in candidates]

    # If Groq is not configured, return top-rated candidates with friendly reasons
    if not groq_client or not groq_api_key:
        fallback = all_products[:req.limit]
        for p in fallback:
            p["reason"] = f"Top-rated pick in {p.get('category', 'our store')} (⭐ {p.get('rating', 4.8)})"
        return {
            "recommendations": fallback,
            "count": len(fallback),
            "context": viewing_context or "Trending recommendations"
        }

    products_context = "\n".join([
        f"- ID:{p['id']} | {p['name']} | ${p['price']} | {p['category']} | {p.get('brand', '')} | {p['description']}"
        for p in all_products
    ])

    prompt = f"""You are a smart e-commerce recommendation engine.

Candidate products:
{products_context}

User context:
- {viewing_context or 'Browsing the store'}
- Interests: {', '.join(req.user_interests) if req.user_interests else 'general shopping'}
- Budget: {'$' + str(req.budget) if req.budget else 'flexible'}
- Category preference: {current_category or 'any'}

Task: Recommend exactly {req.limit} relevant products from the list above.
Return ONLY a valid JSON array with this exact format:
[
  {{"id": "product_id_here", "reason": "concise one-sentence rationale"}}
]
Return only valid JSON."""

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.3,
        )

        raw = response.choices[0].message.content.strip()
        start = raw.find("[")
        end   = raw.rfind("]") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON array found in response")

        recommendations_raw = json.loads(raw[start:end])
        prod_map = {p["id"]: p for p in all_products}

        results = []
        for rec in recommendations_raw[:req.limit]:
            pid = rec.get("id")
            if pid and pid in prod_map and pid != req.product_id:
                p = dict(prod_map[pid])
                p["reason"] = rec.get("reason", "Highly recommended for you")
                results.append(p)

        if results:
            return {
                "recommendations": results,
                "count": len(results),
                "context": viewing_context or "Personalized recommendations"
            }

    except Exception as e:
        print(f"AI recommend fallback: {e}")

    # Fallback: top rated candidates
    fallback = [p for p in all_products if p.get("id") != req.product_id][:req.limit]
    for p in fallback:
        p["reason"] = f"Top-rated favorite (⭐ {p.get('rating', 4.8)})"
    return {
        "recommendations": fallback,
        "count": len(fallback),
        "context": "Popular picks"
    }

@app.get("/trending")
def get_trending(limit: int = 8):
    """Get high-scale trending products sorted by rating and review volume."""
    db = get_db()
    products = [
        serialize(p)
        for p in db.products.find()
        .sort([("rating", pymongo.DESCENDING), ("reviews_count", pymongo.DESCENDING)])
        .limit(limit)
    ]
    return {"trending": products}