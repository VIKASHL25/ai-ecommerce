from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from bson import ObjectId
from jose import JWTError, jwt
import pymongo
import os
import time
import math
from catalog import BIG_SCALE_PRODUCTS

app = FastAPI(title="Products Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "secret")
JWT_ALGORITHM = "HS256"
bearer_scheme = HTTPBearer(auto_error=False)

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
            print(f"Attempt {attempt+1}/30: MongoDB not ready — {e}")
            time.sleep(3)
    raise HTTPException(500, "Database connection failed")

def init_db(force: bool = False):
    db = get_db()
    
    # Create indexes for high-scale querying & search
    try:
        db.products.create_index([("category", pymongo.ASCENDING)])
        db.products.create_index([("price", pymongo.ASCENDING)])
        db.products.create_index([("rating", pymongo.DESCENDING)])
        db.products.create_index([("featured", pymongo.DESCENDING)])
        db.products.create_index([
            ("name", pymongo.TEXT),
            ("description", pymongo.TEXT),
            ("category", pymongo.TEXT),
            ("brand", pymongo.TEXT)
        ], name="product_text_idx")
        print("✅ MongoDB indexes created successfully")
    except Exception as e:
        print(f"⚠️ Index creation notice: {e}")

    # Seed products if empty or if collection has fewer items than our catalog
    current_count = db.products.count_documents({})
    if current_count < len(BIG_SCALE_PRODUCTS) or force:
        if force:
            db.products.delete_many({})
            db.products.insert_many([dict(p) for p in BIG_SCALE_PRODUCTS])
            print(f"✅ Reset & seeded {len(BIG_SCALE_PRODUCTS)} big-scale products")
        else:
            # Upsert by name to preserve catalog integrity without duplicates
            for prod in BIG_SCALE_PRODUCTS:
                db.products.update_one(
                    {"name": prod["name"]},
                    {"$setOnInsert": dict(prod)},
                    upsert=True
                )
            print(f"✅ Verified & seeded big-scale catalog. Current count: {db.products.count_documents({})}")
    else:
        print(f"✅ Products collection ready with {current_count} items")

# ── Startup ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    time.sleep(5)
    init_db()

# ── Auth helper ───────────────────────────────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(401, "Authentication required")
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

# ── Models ────────────────────────────────────────────────────────
class ProductCreate(BaseModel):
    name:          str
    description:   str
    price:         float
    category:      str
    stock:         int
    image:         str = "📦"
    brand:         str = "AI Store"
    rating:        float = 4.8
    reviews_count: int = 100
    featured:      bool = False

class ProductUpdate(BaseModel):
    name:          str | None = None
    description:   str | None = None
    price:         float | None = None
    category:      str | None = None
    stock:         int | None = None
    image:         str | None = None
    brand:         str | None = None
    rating:        float | None = None
    reviews_count: int | None = None
    featured:      bool | None = None

def serialize(product: dict) -> dict:
    product["id"] = str(product.pop("_id"))
    return product

# ── Routes ────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy", "service": "products"}

@app.post("/seed")
def seed_endpoint(force: bool = False):
    """Seed or update database with big-scale catalog."""
    init_db(force=force)
    db = get_db()
    count = db.products.count_documents({})
    return {"message": f"Seeding complete. Total products: {count}", "count": count}

@app.get("/")
def list_products(
    category: str = Query(None),
    min_price: float = Query(None),
    max_price: float = Query(None),
    search: str = Query(None),
    sort_by: str = Query("default"),
    in_stock: bool = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100)
):
    """
    Paginated, high-scale product listing with rich filtering and sorting.
    """
    db = get_db()
    query = {}
    
    if category and category.lower() != "all":
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
        
    if min_price is not None:
        query.setdefault("price", {})["$gte"] = min_price
    if max_price is not None:
        query.setdefault("price", {})["$lte"] = max_price
        
    if in_stock is True:
        query["stock"] = {"$gt": 0}
        
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}}
        ]

    # Sorting logic
    sort_options = {
        "price_asc":  [("price", pymongo.ASCENDING)],
        "price_desc": [("price", pymongo.DESCENDING)],
        "rating":     [("rating", pymongo.DESCENDING)],
        "popular":    [("reviews_count", pymongo.DESCENDING)],
        "newest":     [("_id", pymongo.DESCENDING)],
        "default":    [("featured", pymongo.DESCENDING), ("rating", pymongo.DESCENDING)]
    }
    sort_spec = sort_options.get(sort_by, sort_options["default"])

    total = db.products.count_documents(query)
    skip = (page - 1) * limit
    
    cursor = db.products.find(query).sort(sort_spec).skip(skip).limit(limit)
    products = [serialize(p) for p in cursor]
    
    total_pages = math.ceil(total / limit) if limit > 0 else 1
    
    return {
        "products": products,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }

@app.get("/categories")
def list_categories():
    db = get_db()
    categories = db.products.distinct("category")
    # Clean up empty or null
    categories = [c for c in categories if c]
    return {"categories": categories}

@app.get("/featured")
def list_featured(limit: int = Query(8, le=24)):
    db = get_db()
    products = list(db.products.find({"featured": True}).limit(limit))
    if len(products) < limit:
        remaining = list(db.products.find({"featured": {"$ne": True}}).sort("rating", -1).limit(limit - len(products)))
        products.extend(remaining)
    return {"featured": [serialize(p) for p in products]}

@app.get("/{product_id}")
def get_product(product_id: str):
    db = get_db()
    try:
        product = db.products.find_one({"_id": ObjectId(product_id)})
    except Exception:
        raise HTTPException(400, "Invalid product ID")
    if not product:
        raise HTTPException(404, "Product not found")
    return serialize(product)

@app.post("/")
def create_product(product: ProductCreate,
                   user=Depends(get_current_user)):
    db = get_db()
    result = db.products.insert_one(product.dict())
    new_product = db.products.find_one({"_id": result.inserted_id})
    return {"message": "Product created!", "product": serialize(new_product)}

@app.put("/{product_id}")
def update_product(product_id: str, update: ProductUpdate,
                   user=Depends(get_current_user)):
    db = get_db()
    changes = {k: v for k, v in update.dict().items() if v is not None}
    if not changes:
        raise HTTPException(400, "No fields to update")
    try:
        result = db.products.update_one(
            {"_id": ObjectId(product_id)}, {"$set": changes})
    except Exception:
        raise HTTPException(400, "Invalid product ID")
    if result.matched_count == 0:
        raise HTTPException(404, "Product not found")
    updated = db.products.find_one({"_id": ObjectId(product_id)})
    return {"message": "Product updated!", "product": serialize(updated)}

@app.delete("/{product_id}")
def delete_product(product_id: str, user=Depends(get_current_user)):
    db = get_db()
    try:
        result = db.products.delete_one({"_id": ObjectId(product_id)})
    except Exception:
        raise HTTPException(400, "Invalid product ID")
    if result.deleted_count == 0:
        raise HTTPException(404, "Product not found")
    return {"message": f"Product {product_id} deleted"}