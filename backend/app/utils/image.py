#图像处理工具函数
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from app.utils.logger import logger

def draw_text_on_image(img: np.ndarray, x: int, y: int, label: str, confidence: float) -> np.ndarray:
    """在图像上绘制中文标签和置信度"""
    img_pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(img_pil)
    try:
        font = ImageFont.truetype("simhei.ttf", 20)
    except IOError:
        font = ImageFont.load_default()
        logger.warning("未找到 simhei.ttf 字体文件")

    text = f"{label} {confidence:.2f}"
    draw.text((x, y - 30), text, fill=(0, 255, 0), font=font)
    return cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)