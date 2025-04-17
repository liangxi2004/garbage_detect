#用户认证相关功能（注册、登录、JWT）
from fastapi import APIRouter, Form, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from jose import jwt, JWTError
import bcrypt
import sqlite3
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.database.db import get_db
from app.utils.logger import logger

router = APIRouter()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="无效的令牌")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="无效的令牌")

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="令牌格式错误")
    token = authorization.replace("Bearer ", "")
    user_id = verify_token(token)
    return user_id

@router.post("/register")
async def register(username: str = Form(...), password: str = Form(...)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="用户名已存在")

            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            cursor.execute(
                """
                INSERT INTO users (username, password_hash, created_at)
                VALUES (?, ?, ?)
                """,
                (username, password_hash, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
            logger.info(f"用户注册成功: username={username}")
            return JSONResponse(content={"message": "注册成功"})
    except sqlite3.Error as e:
        logger.error(f"注册失败: {e}")
        raise HTTPException(status_code=500, detail="注册失败")

@router.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    try:
        logger.info(f"收到登录请求: username={username}")
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT user_id, password_hash FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            
            if not user:
                logger.warning(f"登录失败: 用户不存在 username={username}")
                raise HTTPException(status_code=401, detail="用户名或密码错误")

            if not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"]):
                logger.warning(f"登录失败: 密码错误 username={username}")
                raise HTTPException(status_code=401, detail="用户名或密码错误")

            access_token = create_access_token(data={"user_id": user["user_id"]})
            logger.info(f"登录成功: username={username}, user_id={user['user_id']}")
            
            return JSONResponse(
                content={
                    "access_token": access_token,
                    "token_type": "bearer",
                    "user_id": user["user_id"]
                },
                status_code=200,
                headers={
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                }
            )
    except sqlite3.Error as e:
        logger.error(f"数据库错误: {e}")
        raise HTTPException(status_code=500, detail="登录失败，请稍后重试")
    except Exception as e:
        logger.error(f"登录过程发生错误: {e}")
        raise HTTPException(status_code=500, detail="登录失败，请稍后重试")