#全局配置，包括路径、密钥和模型参数
import os
from pathlib import Path

# 路径配置
BASE_DIR = Path("D:/u_Information/03/PyCharm 2024.2.3/project4/Garbage_detect/backend")
DB_PATH = BASE_DIR / "garbage_sort.db"
RESULTS_DIR = BASE_DIR / "results"
LOG_DIR = BASE_DIR / "logs"
MODEL_PATH = BASE_DIR / "model/best.pt"

# 确保目录存在
RESULTS_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# 调试：打印 MODEL_PATH
print(f"MODEL_PATH: {MODEL_PATH}")
print(f"MODEL_PATH exists: {MODEL_PATH.exists()}")

# JWT 配置
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Ollama 配置
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "my-model")

# 跨域配置
# ALLOWED_ORIGINS = [
#     "http://localhost:3000",
#     "http://127.0.0.1:3000",
#     "http://localhost:63342",  # 添加前端运行的源
# ]

ALLOWED_ORIGINS = ["*"]