#数据库 CRUD 操作和历史记录相关路由
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from app.database.db import get_db
from app.auth.auth import get_current_user
from app.config import RESULTS_DIR
from app.utils.logger import logger
import sqlite3
import os
from datetime import date
from pathlib import Path

router = APIRouter()

@router.get("/detection_history")
async def get_detection_history(
    search: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user_id: int = Depends(get_current_user)
):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            count_query = """
                SELECT COUNT(DISTINCT request_id)
                FROM detection_history
                WHERE user_id = ? AND request_id IN (
                    SELECT DISTINCT request_id 
                    FROM detection_details
                    WHERE (class LIKE ? OR ? IS NULL) AND user_id = ?
                )
            """
            search_param = f"%{search}%" if search else None
            cursor.execute(count_query, (user_id, search_param, search_param, user_id))
            total_count = cursor.fetchone()[0]
            total_pages = math.ceil(total_count / per_page) if total_count > 0 else 1

            query = """
                SELECT request_id, filename, result_image_path, timestamp
                FROM detection_history
                WHERE user_id = ? AND request_id IN (
                    SELECT DISTINCT request_id 
                    FROM detection_details
                    WHERE (class LIKE ? OR ? IS NULL) AND user_id = ?
                )
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """
            offset = (page - 1) * per_page
            cursor.execute(query, (user_id, search_param, search_param, user_id, per_page, offset))
            history = []
            for row in cursor.fetchall():
                cursor.execute(
                    """
                    SELECT class, confidence, action, timestamp
                    FROM detection_details
                    WHERE request_id = ? AND user_id = ?
                    """,
                    (row["request_id"], user_id)
                )
                detections = [
                    {
                        "class": detail["class"],
                        "confidence": detail["confidence"],
                        "action": detail["action"],
                        "timestamp": detail["timestamp"]
                    }
                    for detail in cursor.fetchall()
                ]
                history.append({
                    "request_id": row["request_id"],
                    "filename": row["filename"],
                    "result_image_path": row["result_image_path"],
                    "timestamp": row["timestamp"],
                    "detections": detections
                })

            logger.info(f"返回检测历史记录，user_id={user_id}, 搜索: {search}, 页码: {page}, 每页: {per_page}")
            return JSONResponse(content={
                "history": history,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page
            })
    except sqlite3.Error as e:
        logger.error(f"获取检测历史失败: {e}")
        raise HTTPException(status_code=500, detail="获取检测历史失败")

@router.get("/qa_history")
async def get_qa_history(
    search: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    user_id: int = Depends(get_current_user)
):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            count_query = """
                SELECT COUNT(*)
                FROM qa_history
                WHERE user_id = ? AND (question LIKE ? OR ? IS NULL)
            """
            search_param = f"%{search}%" if search else None
            cursor.execute(count_query, (user_id, search_param, search_param))
            total_count = cursor.fetchone()[0]
            total_pages = math.ceil(total_count / per_page) if total_count > 0 else 1

            query = """
                SELECT request_id, question, answer, confidence, timestamp
                FROM qa_history
                WHERE user_id = ? AND (question LIKE ? OR ? IS NULL)
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            """
            offset = (page - 1) * per_page
            cursor.execute(query, (user_id, search_param, search_param, per_page, offset))
            history = [
                {
                    "request_id": row["request_id"],
                    "question": row["question"],
                    "answer": row["answer"],
                    "confidence": row["confidence"],
                    "timestamp": row["timestamp"]
                }
                for row in cursor.fetchall()
            ]

            logger.info(f"返回问答历史记录，user_id={user_id}, 搜索: {search}, 页码: {page}, 每页: {per_page}")
            return JSONResponse(content={
                "history": history,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page
            })
    except sqlite3.Error as e:
        logger.error(f"获取问答历史失败: {e}")
        raise HTTPException(status_code=500, detail="获取问答历史失败")

@router.get("/result_image/{request_id}")
async def get_result_image(request_id: str):
    image_path = RESULTS_DIR / f"{request_id}.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="图片不存在")
    return FileResponse(image_path, media_type="image/jpeg")

@router.delete("/delete_history/{request_id}")
async def delete_history(
    request_id: str,
    history_type: str = "detection",
    user_id: int = Depends(get_current_user)
):
    with get_db() as conn:
        cursor = conn.cursor()
        if history_type == "detection":
            cursor.execute(
                "SELECT COUNT(*) FROM detection_history WHERE request_id = ? AND user_id = ?",
                (request_id, user_id)
            )
            if cursor.fetchone()[0] == 0:
                raise HTTPException(status_code=404, detail="检测记录不存在")

            image_path = RESULTS_DIR / f"{request_id}.jpg"
            if image_path.exists():
                os.remove(image_path)
                logger.info(f"删除图片: {image_path}")

            cursor.execute("DELETE FROM detection_details WHERE request_id = ? AND user_id = ?", (request_id, user_id))
            cursor.execute("DELETE FROM detection_history WHERE request_id = ? AND user_id = ?", (request_id, user_id))
            conn.commit()
            logger.info(f"删除检测历史记录: Request ID={request_id}, user_id={user_id}")
            return JSONResponse(content={"message": "检测记录已删除"})

        elif history_type == "qa":
            cursor.execute(
                "SELECT COUNT(*) FROM qa_history WHERE request_id = ? AND user_id = ?",
                (request_id, user_id)
            )
            if cursor.fetchone()[0] == 0:
                raise HTTPException(status_code=404, detail="问答记录不存在")

            cursor.execute("DELETE FROM qa_history WHERE request_id = ? AND user_id = ?", (request_id, user_id))
            conn.commit()
            logger.info(f"删除问答历史记录: Request ID={request_id}, user_id={user_id}")
            return JSONResponse(content={"message": "问答记录已删除"})

        else:
            raise HTTPException(status_code=400, detail="无效的历史记录类型，仅支持 'detection' 或 'qa'")

@router.delete("/delete_all_history")
async def delete_all_history(user_id: int = Depends(get_current_user)):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT result_image_path FROM detection_history WHERE user_id = ?", (user_id,))
        for row in cursor.fetchall():
            image_path = Path(row[0])
            if image_path.exists():
                os.remove(image_path)
                logger.info(f"删除图片: {image_path}")

        cursor.execute("DELETE FROM detection_details WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM detection_history WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM qa_history WHERE user_id = ?", (user_id,))
        conn.commit()
        logger.info(f"已清空用户所有检测和问答历史记录: user_id={user_id}")

    return JSONResponse(content={"message": "所有检测和问答历史记录已删除"})

@router.get("/stats")
async def get_stats(user_id: int = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM detection_history WHERE user_id = ?", (user_id,))
            total_detections = cursor.fetchone()[0]
            today = date.today().strftime("%Y-%m-%d")
            cursor.execute(
                """
                SELECT COUNT(*) FROM detection_history
                WHERE user_id = ? AND timestamp LIKE ?
                """,
                (user_id, f"{today}%")
            )
            daily_detections = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM qa_history WHERE user_id = ?", (user_id,))
            total_qa = cursor.fetchone()[0]
            stats = {
                "total_detections": total_detections,
                "daily_detections": daily_detections,
                "total_qa": total_qa
            }
            logger.info(f"返回统计数据: user_id={user_id}, stats={stats}")
            return JSONResponse(content=stats)
    except sqlite3.Error as e:
        logger.error(f"获取统计数据失败: {e}")
        raise HTTPException(status_code=500, detail="获取统计数据失败")

@router.get("/waste_categories")
async def get_waste_categories(user_id: int = Depends(get_current_user)):
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT SUBSTR("class", 1, INSTR("class", '/') - 1) AS category, COUNT(*) AS count
                FROM detection_details
                WHERE user_id = ?
                GROUP BY category
                """,
                (user_id,)
            )
            waste_categories = [
                {"category": row[0], "count": row[1]}
                for row in cursor.fetchall()
            ]
            if not waste_categories:
                waste_categories = [
                    {"category": "厨余垃圾", "count": 0},
                    {"category": "可回收物", "count": 0},
                    {"category": "其他垃圾", "count": 0},
                    {"category": "有害垃圾", "count": 0}
                ]
            logger.info(f"返回垃圾分类统计: user_id={user_id}, categories={waste_categories}")
            return JSONResponse(content=waste_categories)
    except sqlite3.Error as e:
        logger.error(f"获取垃圾分类统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取垃圾分类统计失败")