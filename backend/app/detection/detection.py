#图像检测相关功能（YOLO 预测、结果处理）
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import Response, JSONResponse
from ultralytics import YOLO
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
from collections import defaultdict
import time
from app.config import MODEL_PATH, RESULTS_DIR
from app.data.class_map import CLASS_NAME_MAP
from app.data.action_map import ACTION_MAP
from app.database.db import get_db
from app.auth.auth import get_current_user
from app.utils.logger import logger
from app.utils.image import draw_text_on_image

router = APIRouter()

# 加载 YOLO 模型
try:
    model = YOLO(MODEL_PATH)
except FileNotFoundError as e:
    logger.error(f"无法加载 YOLO 模型: {e}")
    raise HTTPException(status_code=500, detail=f"无法加载 YOLO 模型文件: {MODEL_PATH}")
except Exception as e:
    logger.error(f"加载 YOLO 模型时发生未知错误: {e}")
    raise HTTPException(status_code=500, detail="加载 YOLO 模型失败")

detection_store = defaultdict(list)

@router.post("/predict")
async def predict(
    file: UploadFile = File(...),
    save_to_history: bool = Form(True),
    user_id: int = Depends(get_current_user)
):
    start_time = time.time()
    request_id = str(int(time.time() * 1000))
    logger.info(f"收到请求: Request ID={request_id}, user_id={user_id}, save_to_history={save_to_history}")

    file_content = await file.read()
    npimg = np.frombuffer(file_content, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "无效的图像文件")

    results = model.predict(img, verbose=False)
    detected_classes = []
    detections = []
    for r in results:
        if r.boxes is not None:
            for box, cls, conf in zip(r.boxes.xyxy, r.boxes.cls, r.boxes.conf):
                x1, y1, x2, y2 = map(int, box[:4])
                label = model.names[int(cls)]
                confidence = float(conf)
                chinese_label = CLASS_NAME_MAP.get(label, label)

                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                img = draw_text_on_image(img, x1, y1, chinese_label, confidence)

                detected_classes.append(label)
                detections.append({
                    "class": chinese_label,
                    "confidence": confidence,
                    "action": ACTION_MAP.get(label, "放入其他垃圾桶"),
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })

    detection_store[request_id] = detections
    result_image_path = RESULTS_DIR / f"{request_id}.jpg"
    cv2.imwrite(str(result_image_path), img)

    if save_to_history:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO detection_history (request_id, user_id, filename, result_image_path, timestamp)
                VALUES (?, ?, ?, ?, ?)
                """,
                (request_id, user_id, file.filename, str(result_image_path), datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
            )
            for detection in detections:
                cursor.execute(
                    """
                    INSERT INTO detection_details (request_id, user_id, class, confidence, action, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        request_id,
                        user_id,
                        detection["class"],
                        detection["confidence"],
                        detection["action"],
                        detection["timestamp"]
                    )
                )
            conn.commit()
            logger.info(f"保存检测历史记录到数据库: Request ID={request_id}, user_id={user_id}")

    _, img_encoded = cv2.imencode('.jpg', img)
    proc_time = time.time() - start_time
    logger.info(
        f"检测完成: {file.filename} | 检测数: {len(detected_classes)} | 耗时: {proc_time:.2f}s | Request ID: {request_id}"
    )
    headers = {"X-Request-ID": request_id}
    return Response(content=img_encoded.tobytes(), media_type="image/jpeg", headers=headers)

@router.get("/details")
async def get_predict_details(request_id: str):
    detections = detection_store.get(request_id, [])
    logger.info(f"请求详情: Request ID={request_id}, 检测数={len(detections)}")
    if not detections and request_id in detection_store:
        del detection_store[request_id]
    return JSONResponse(content={"detections": detections})