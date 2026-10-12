from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from bson import ObjectId
import pymongo
import os
import time
import json
import re

app = FastAPI(title="AI Search Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────
GROQ_MODEL  = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
groq_api_key = os.environ.get("GROQ_API_KEY", "")
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

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

def serialize(p):
    p["id"] = str(p.pop("_id"))
    return p

# ── Routes ────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy", "service": "ai-search"}

@app.get("/")
def smart_search(q: str = Query(..., min_length=1), limit: int = Query(20, le=50)):
    """
    Big-scale AI-powered semantic search.
    Stage 1: Multi-field candidate pre-filtering to scale across thousands of items.
    Stage 2: LLM semantic re-ranking and intent reasoning.
    """
    db = get_db()
    query_clean = q.strip()

    # Stage 1: Candidate pre-selection for scale
    # Extract search tokens
    tokens = [t for t in re.split(r'\s+', query_clean) if len(t) > 2]
    candidate_queries = [
        {"name":        {"$regex": query_clean, "$options": "i"}},
        {"category":    {"$regex": query_clean, "$options": "i"}},
        {"brand":       {"$regex": query_clean, "$options": "i"}},
        {"description": {"$regex": query_clean, "$options": "i"}}
    ]
    for token in tokens[:4]:
        candidate_queries.append({"name": {"$regex": token, "$options": "i"}})
        candidate_queries.append({"category": {"$regex": token, "$options": "i"}})

    candidate_filter = {"$or": candidate_queries}
    candidates = list(db.products.find(candidate_filter).limit(30))

    # If few direct matches, include diverse top-rated/featured products to give AI breadth
    if len(candidates) < 15:
        existing_ids = {c["_id"] for c in candidates}
        supplemental = list(db.products.find({"_id": {"$nin": list(existing_ids)}}).sort("rating", -1).limit(25 - len(candidates)))
        candidates.extend(supplemental)

    candidate_products = [serialize(p) for p in candidates]

    # If no groq client or candidate pool is small, perform fast fallback
    if not groq_client or not groq_api_key:
        return {
            "query":      q,
            "results":    candidate_products[:limit],
            "count":      len(candidate_products[:limit]),
            "ai_powered": False
        }

    products_context = "\n".join([
        f"ID:{p['id']} | {p['name']} | ${p['price']} | {p['category']} | {p.get('brand', '')} | {p['description']}"
        for p in candidate_products
    ])

    prompt = f"""You are an intelligent e-commerce product search engine.

Candidate catalog:
{products_context}

Customer search query: "{q}"

Instructions:
1. Understand customer intent, synonyms, and context.
2. Select the most relevant products from the candidate catalog.
3. Return ONLY a valid JSON array of objects with keys "id", "score" (1-10), and "match_reason".
4. Score 10 for exact or best matches, 7-9 for strongly related items.

Return format:
[
  {{"id": "product_id", "score": 9, "match_reason": "brief reason"}}
]

Return only truly relevant items. Return empty [] if no candidates fit."""

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.1,
        )

        raw = response.choices[0].message.content.strip()
        start = raw.find("[")
        end   = raw.rfind("]") + 1

        if start == -1 or end == 0:
            raise ValueError("No JSON array returned")

        ai_results = json.loads(raw[start:end])
        ai_results.sort(key=lambda x: x.get("score", 0), reverse=True)

        results = []
        candidate_dict = {p["id"]: p for p in candidate_products}

        for res in ai_results:
            pid = res.get("id")
            if pid and pid in candidate_dict:
                p = dict(candidate_dict[pid])
                p["relevance_score"] = res.get("score", 7)
                p["match_reason"]    = res.get("match_reason", "Matched via AI semantic search")
                results.append(p)

        # If AI found good results
        if results:
            return {
                "query":      q,
                "results":    results[:limit],
                "count":      len(results[:limit]),
                "ai_powered": True
            }

        # Fallback if AI returned empty but candidates exist
        return {
            "query":      q,
            "results":    candidate_products[:limit],
            "count":      len(candidate_products[:limit]),
            "ai_powered": False
        }

    except Exception as e:
        print(f"AI search fallback due to: {e}")
        return {
            "query":      q,
            "results":    candidate_products[:limit],
            "count":      len(candidate_products[:limit]),
            "ai_powered": False
        }

@app.get("/suggest")
def search_suggestions(q: str = Query(..., min_length=1)):
    """Get AI or database-backed search suggestions."""
    db = get_db()
    # Fast prefix matches from database
    db_matches = list(db.products.find(
        {"name": {"$regex": f"^{q}", "$options": "i"}},
        {"name": 1}
    ).limit(5))
    if db_matches:
        return {"query": q, "suggestions": [m["name"] for m in db_matches]}

    # Fallback to groq if available
    if groq_client and groq_api_key:
        try:
            response = groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{
                    "role": "user",
                    "content": f"""For query "{q}" in an e-commerce marketplace selling Electronics, Mobile, Gaming, Smart Home, Fashion, Sports, Books, Health:
Suggest 5 popular search queries.
Return ONLY JSON array of strings: ["suggestion 1", "suggestion 2"]"""
                }],
                max_tokens=100,
                temperature=0.3,
            )
            raw = response.choices[0].message.content.strip()
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start != -1 and end != 0:
                suggestions = json.loads(raw[start:end])
                return {"query": q, "suggestions": suggestions[:5]}
        except Exception:
            pass

    return {"query": q, "suggestions": []}