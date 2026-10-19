from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import hashlib # مكتبة التشفير لحماية الأرقام السرية

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- النماذج (Models) ---
class Subscription(BaseModel):
    id: str
    name: str
    price: float
    cycle: str
    nextDate: str
    category: str
    isTrial: bool
    user_id: str # رقم المستخدم لربط الاشتراك بصاحبه

class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

# --- دالة تشفير كلمة المرور ---
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# --- إعداد قاعدة البيانات ---
def init_db():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    
    # جدول المستخدمين
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT
        )
    """)

    # جدول الاشتراكات
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id TEXT PRIMARY KEY,
            name TEXT,
            price REAL,
            cycle TEXT,
            nextDate TEXT,
            category TEXT,
            isTrial BOOLEAN,
            user_id TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

# --- مسارات الحسابات (Auth) ---

@app.post("/api/register")
def register_user(user: UserRegister):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    
    # التشفير قبل الحفظ
    hashed_pw = hash_password(user.password)
    
    try:
        cursor.execute("""
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        """, (user.name, user.email, hashed_pw))
        
        user_id = cursor.lastrowid
        conn.commit()
        
        return {"status": "success", "user_id": str(user_id), "name": user.name}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجل مسبقاً")
    finally:
        conn.close()

@app.post("/api/login")
def login_user(user: UserLogin):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    
    hashed_pw = hash_password(user.password)
    
    cursor.execute("SELECT id, name FROM users WHERE email=? AND password=?", (user.email, hashed_pw))
    result = cursor.fetchone()
    conn.close()
    
    if result:
        return {"status": "success", "user_id": str(result[0]), "name": result[1]}
    else:
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")


# --- مسارات الاشتراكات ---

@app.post("/api/add-subscription")
def add_sub(sub: Subscription):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO subscriptions (id, name, price, cycle, nextDate, category, isTrial, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (sub.id, sub.name, sub.price, sub.cycle, sub.nextDate, sub.category, sub.isTrial, sub.user_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/subscriptions/{user_id}")
def get_subs(user_id: str):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subscriptions WHERE user_id=?", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    subs_list = []
    for row in rows:
        subs_list.append({
            "id": row[0],
            "name": row[1],
            "price": row[2],
            "cycle": row[3],
            "nextDate": row[4],
            "category": row[5],
            "isTrial": bool(row[6]),
            "user_id": row[7]
        })
    return subs_list

# مسار حذف اشتراك نهائياً
@app.delete("/api/delete-subscription/{sub_id}")
def delete_sub(sub_id: str):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM subscriptions WHERE id=?", (sub_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "تم الحذف من قاعدة البيانات"}