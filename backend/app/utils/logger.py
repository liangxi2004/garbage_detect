#日志配置，支持文件和控制台输出
import logging
from app.config import LOG_DIR

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "app.log"),
        logging.StreamHandler()  # 添加控制台输出
    ]
)
logger = logging.getLogger("app")