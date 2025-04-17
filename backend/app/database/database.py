import sqlite3
from log import logger
import os

# 数据库文件路径
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'data', 'app.db')

def get_db():
    """获取数据库连接"""
    try:
        # 确保数据库目录存在
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # 使用字典形式返回结果
        logger.info(f"成功连接到数据库: {DB_PATH}")
        return conn
    except sqlite3.Error as e:
        logger.error(f"数据库连接失败: {e}")
        raise
    except Exception as e:
        logger.error(f"数据库连接过程发生错误: {e}")
        raise

def close_db(conn):
    """关闭数据库连接"""
    if conn is not None:
        try:
            conn.close()
            logger.info("数据库连接已关闭")
        except Exception as e:
            logger.error(f"关闭数据库连接时发生错误: {e}")
            raise

def init_db():
    try:
        logger.info("开始初始化数据库...")
        with get_db() as conn:
            cursor = conn.cursor()
            
            # 创建用户表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("用户表创建成功")
            
            # 创建检测记录表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS detections (
                    detection_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    image_path TEXT NOT NULL,
                    result TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            """)
            logger.info("检测记录表创建成功")
            
            # 创建问题记录表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS questions (
                    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (user_id)
                )
            """)
            logger.info("问题记录表创建成功")
            
            conn.commit()
            logger.info("数据库初始化完成")
            
    except sqlite3.Error as e:
        logger.error(f"数据库初始化失败: {e}")
        raise
    except Exception as e:
        logger.error(f"数据库初始化过程发生错误: {e}")
        raise 

def create_user(username, password_hash):
    """创建新用户"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        logger.info(f"成功创建用户: {username}")
        return user_id
    except sqlite3.Error as e:
        logger.error(f"创建用户失败: {e}")
        raise
    finally:
        close_db(conn)

def get_user_by_username(username):
    """通过用户名获取用户"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        if user:
            logger.info(f"成功获取用户: {username}")
            return dict(user)
        logger.warning(f"未找到用户: {username}")
        return None
    except sqlite3.Error as e:
        logger.error(f"获取用户失败: {e}")
        raise
    finally:
        close_db(conn)

def get_user_by_id(user_id):
    """通过用户ID获取用户"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        user = cursor.fetchone()
        if user:
            logger.info(f"成功获取用户ID: {user_id}")
            return dict(user)
        logger.warning(f"未找到用户ID: {user_id}")
        return None
    except sqlite3.Error as e:
        logger.error(f"获取用户失败: {e}")
        raise
    finally:
        close_db(conn)

def create_detection(user_id, image_path, result, confidence):
    """创建新的检测记录"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO detections 
               (user_id, image_path, result, confidence, created_at) 
               VALUES (?, ?, ?, ?, datetime('now'))""",
            (user_id, image_path, result, confidence)
        )
        conn.commit()
        detection_id = cursor.lastrowid
        logger.info(f"成功创建检测记录: {detection_id}")
        return detection_id
    except sqlite3.Error as e:
        logger.error(f"创建检测记录失败: {e}")
        raise
    finally:
        close_db(conn)

def get_user_detections(user_id, limit=10, offset=0):
    """获取用户的检测记录"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT * FROM detections 
               WHERE user_id = ? 
               ORDER BY created_at DESC 
               LIMIT ? OFFSET ?""",
            (user_id, limit, offset)
        )
        detections = cursor.fetchall()
        logger.info(f"成功获取用户 {user_id} 的检测记录")
        return [dict(detection) for detection in detections]
    except sqlite3.Error as e:
        logger.error(f"获取检测记录失败: {e}")
        raise
    finally:
        close_db(conn)

def get_detection_by_id(detection_id):
    """通过ID获取检测记录"""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM detections WHERE detection_id = ?", (detection_id,))
        detection = cursor.fetchone()
        if detection:
            logger.info(f"成功获取检测记录: {detection_id}")
            return dict(detection)
        logger.warning(f"未找到检测记录: {detection_id}")
        return None
    except sqlite3.Error as e:
        logger.error(f"获取检测记录失败: {e}")
        raise
    finally:
        close_db(conn)