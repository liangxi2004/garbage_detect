# FastAPI 应用入口，定义中间件和加载路由
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import ALLOWED_ORIGINS
from app.auth.auth import router as auth_router
from app.detection.detection import router as detection_router
from app.qa.qa import router as qa_router
from app.database.models import router as db_router
from app.utils.knowledge import router as knowledge_router  # 添加导入

app = FastAPI(title="Garbage Detection API")

# 跨域中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"]
)

# 注册路由
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(detection_router, prefix="/detection", tags=["detection"])
app.include_router(qa_router, prefix="/qa", tags=["qa"])
app.include_router(db_router, prefix="/db", tags=["database"])
app.include_router(knowledge_router, prefix="/db", tags=["knowledge"])  # 注册 knowledge_router

@app.on_event("startup")
async def startup_event():
    from app.database.db import init_db
    init_db()