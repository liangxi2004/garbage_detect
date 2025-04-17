#数据库初始化和连接管理
import sqlite3
from contextlib import contextmanager
from app.config import DB_PATH
from app.utils.logger import logger

def init_db():
    """初始化 SQLite 数据库和表"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # 用户表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT
                )
            """)
            # 检测历史表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS detection_history (
                    request_id TEXT PRIMARY KEY,
                    user_id INTEGER,
                    filename TEXT,
                    result_image_path TEXT,
                    timestamp TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            """)
            # 检测详情表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS detection_details (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT,
                    user_id INTEGER,
                    class TEXT,
                    confidence REAL,
                    action TEXT,
                    timestamp TEXT,
                    FOREIGN KEY (request_id) REFERENCES detection_history (request_id),
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            """)
            # 问答历史表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS qa_history (
                    request_id TEXT PRIMARY KEY,
                    user_id INTEGER,
                    question TEXT,
                    answer TEXT,
                    confidence REAL,
                    timestamp TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            """)
            conn.commit()
            logger.info("SQLite 数据库初始化完成")
    except sqlite3.Error as e:
        logger.error(f"数据库初始化失败: {e}")
        raise

@contextmanager
def get_db():
    """提供数据库连接的上下文管理器"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()