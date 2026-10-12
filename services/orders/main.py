from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from bson import ObjectId
import mysql.connector
import pymongo
import os
import time

app = FastAPI(title="Orders Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# ── Config ────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "secret")
JWT_ALGORITHM = "HS256"
bearer_scheme = HTTPBearer()

# ── MySQL connection ──────────────────────────────────────────────
def get_mysql():
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
            print(f"Attempt {attempt+1}/30: MySQL not ready — {e}")
            time.sleep(3)
    raise HTTPException(500, "MySQL connection failed")

# ── MongoDB connection (to read product details) ──────────────────
def get_mongo():
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
    raise HTTPException(500, "MongoDB connection failed")

# ── Init tables ───────────────────────────────────────────────────
def init_db():
    conn = get_mysql()
    cursor = conn.cursor()
    # Orders table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_id      INT NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL,
            status       ENUM('pending','confirmed','shipped','delivered','cancelled')
                         DEFAULT 'pending',
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
                         ON UPDATE CURRENT_TIMESTAMP
        )
    """)
    # Order items table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            order_id    INT NOT NULL,
            product_id  VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            quantity    INT NOT NULL,
            price       DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    """)
    # Cart table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cart (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            user_id     INT NOT NULL,
            product_id  VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            price       DECIMAL(10,2) NOT NULL,
            quantity    INT NOT NULL DEFAULT 1,
            image       VARCHAR(10) DEFAULT '📦',
            added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_cart_item (user_id, product_id)
        )
    """)
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Orders, order_items, cart tables ready")

# ── Startup ───────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    time.sleep(5)
    init_db()

# ── Auth helper ───────────────────────────────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

# ── Models ────────────────────────────────────────────────────────
class CartItem(BaseModel):
    product_id:   str
    product_name: str
    price:        float
    quantity:     int = 1
    image:        str = "📦"

class UpdateQuantity(BaseModel):
    quantity: int

class CheckoutRequest(BaseModel):
    pass  # uses current cart items

# ── Cart Routes ───────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy", "service": "orders"}

@app.get("/cart")
def get_cart(user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM cart WHERE user_id = %s ORDER BY added_at DESC",
        (user["user_id"],)
    )
    items = cursor.fetchall()
    cursor.close(); conn.close()
    total = sum(float(i["price"]) * i["quantity"] for i in items)
    return {"cart": items, "total": round(total, 2),
            "item_count": len(items)}

@app.post("/cart")
def add_to_cart(item: CartItem, user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO cart (user_id, product_id, product_name, price, quantity, image)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE quantity = quantity + %s
    """, (user["user_id"], item.product_id, item.product_name,
          item.price, item.quantity, item.image, item.quantity))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": f"'{item.product_name}' added to cart!"}

@app.put("/cart/{product_id}")
def update_cart_item(product_id: str, update: UpdateQuantity,
                     user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor()
    if update.quantity <= 0:
        cursor.execute(
            "DELETE FROM cart WHERE user_id = %s AND product_id = %s",
            (user["user_id"], product_id)
        )
    else:
        cursor.execute(
            "UPDATE cart SET quantity = %s WHERE user_id = %s AND product_id = %s",
            (update.quantity, user["user_id"], product_id)
        )
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Cart updated!"}

@app.delete("/cart/{product_id}")
def remove_from_cart(product_id: str, user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM cart WHERE user_id = %s AND product_id = %s",
        (user["user_id"], product_id)
    )
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Item removed from cart!"}

@app.delete("/cart")
def clear_cart(user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cart WHERE user_id = %s", (user["user_id"],))
    conn.commit()
    cursor.close(); conn.close()
    return {"message": "Cart cleared!"}

# ── Order Routes ──────────────────────────────────────────────────
@app.post("/checkout")
def checkout(user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor(dictionary=True)

    # Get cart items
    cursor.execute(
        "SELECT * FROM cart WHERE user_id = %s", (user["user_id"],)
    )
    cart_items = cursor.fetchall()
    if not cart_items:
        cursor.close(); conn.close()
        raise HTTPException(400, "Cart is empty!")

    # Calculate total
    total = sum(float(i["price"]) * i["quantity"] for i in cart_items)

    # Create order
    cursor.execute(
        "INSERT INTO orders (user_id, total_amount) VALUES (%s, %s)",
        (user["user_id"], round(total, 2))
    )
    order_id = cursor.lastrowid

    # Create order items
    for item in cart_items:
        cursor.execute("""
            INSERT INTO order_items
            (order_id, product_id, product_name, quantity, price)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, item["product_id"], item["product_name"],
              item["quantity"], item["price"]))

    # Clear cart
    cursor.execute("DELETE FROM cart WHERE user_id = %s", (user["user_id"],))
    conn.commit()
    cursor.close(); conn.close()

    return {
        "message": "Order placed successfully! 🎉",
        "order_id": order_id,
        "total": round(total, 2),
        "items": len(cart_items)
    }

@app.get("/")
def get_orders(user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC",
        (user["user_id"],)
    )
    orders = cursor.fetchall()
    # Convert datetime to string
    for order in orders:
        order["created_at"] = str(order["created_at"])
        order["updated_at"] = str(order["updated_at"])
    cursor.close(); conn.close()
    return {"orders": orders}

@app.get("/{order_id}")
def get_order(order_id: int, user=Depends(get_current_user)):
    conn = get_mysql()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM orders WHERE id = %s AND user_id = %s",
        (order_id, user["user_id"])
    )
    order = cursor.fetchone()
    if not order:
        cursor.close(); conn.close()
        raise HTTPException(404, "Order not found")
    # Get order items
    cursor.execute(
        "SELECT * FROM order_items WHERE order_id = %s", (order_id,)
    )
    items = cursor.fetchall()
    order["created_at"] = str(order["created_at"])
    order["updated_at"] = str(order["updated_at"])
    cursor.close(); conn.close()
    return {"order": order, "items": items}