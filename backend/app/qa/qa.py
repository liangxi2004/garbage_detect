#问答系统相关功能（Ollama API 调用）
from fastapi import APIRouter, Form, Depends
from fastapi.responses import StreamingResponse, JSONResponse
import requests
import json
from datetime import datetime
import time
from app.config import OLLAMA_API_URL, OLLAMA_MODEL
from app.database.db import get_db
from app.auth.auth import get_current_user
from app.utils.logger import logger

router = APIRouter()

# async def call_ollama_stream(question: str):
#     logger.info(f"调用 Ollama API: URL={OLLAMA_API_URL}, Model={OLLAMA_MODEL}, Question={question}")
#     try:
#         markdown_prompt = (
#             f"请以 Markdown 格式回答以下问题，确保使用清晰的标题、列表、加粗等语法来组织内容：\n\n{question}"
#         )
#         payload = {
#             "model": OLLAMA_MODEL,
#             "prompt": markdown_prompt,
#             "stream": True
#         }
#         response = requests.post(
#             OLLAMA_API_URL,
#             json=payload,
#             stream=True,
#             timeout=30,
#             headers={"Content-Type": "application/json"}
#         )
#
#         if response.status_code != 200:
#             logger.error(f"Ollama API 调用失败，状态码：{response.status_code}, 响应：{response.text}")
#             yield json.dumps({"answer": "抱歉，服务器内部错误，请稍后重试。", "score": 0.1})
#             return
#
#         for line in response.iter_lines():
#             if line:
#                 try:
#                     result = json.loads(line.decode('utf-8'))
#                     answer_chunk = result.get("response", "")
#                     if answer_chunk:
#                         yield json.dumps({"answer": answer_chunk, "score": 0.95})
#                     if result.get("done", False):
#                         logger.info("流式响应完成")
#                         break
#                 except json.JSONDecodeError as e:
#                     logger.error(f"JSON 解析错误：{e}, 原始数据：{line.decode('utf-8')}")
#                     yield json.dumps({"answer": "抱歉，数据解析错误。", "score": 0.1})
#                     break
#     except requests.exceptions.Timeout:
#         logger.error("Ollama API 超时")
#         yield json.dumps({"answer": "抱歉，服务器响应超时，请稍后重试。", "score": 0.1})
#     except requests.exceptions.ConnectionError:
#         logger.error("Ollama API 连接失败")
#         yield json.dumps({"answer": "抱歉，无法连接到模型服务，请检查服务器状态。", "score": 0.1})
#     except Exception as e:
#         logger.error(f"未预期的错误：{e}")
#         yield json.dumps({"answer": "抱歉，系统发生未知错误，请联系管理员。", "score": 0.1})

async def call_ollama_stream(question: str):
    logger.info(f"调用 Ollama API: URL={OLLAMA_API_URL}, Model={OLLAMA_MODEL}, Question={question}, 时间: {datetime.now().isoformat()}")
    try:
        markdown_prompt = (
            f"请以 Markdown 格式回答以下问题，确保使用清晰的标题、列表、加粗等语法来组织内容：\n\n{question}"
        )
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": markdown_prompt,
            "stream": True
        }
        start_time = time.time()
        response = requests.post(
            OLLAMA_API_URL,
            json=payload,
            stream=True,
            timeout=30,  # 30秒超时
            headers={"Content-Type": "application/json"}
        )
        logger.info(f"Ollama API 请求发起，耗时: {time.time() - start_time:.2f}s, 时间: {datetime.now().isoformat()}")

        if response.status_code != 200:
            logger.error(f"Ollama API 调用失败，状态码: {response.status_code}, 响应: {response.text}")
            yield json.dumps({"answer": "抱歉，服务器内部错误，请稍后重试。", "score": 0.1}) + "\n"
            return

        buffer = ""
        first_chunk_time = None
        for line in response.iter_lines():
            if line:
                if not first_chunk_time:
                    first_chunk_time = time.time()
                    logger.info(f"收到 Ollama 首个数据块，延迟: {first_chunk_time - start_time:.2f}s, 时间: {datetime.now().isoformat()}")
                try:
                    result = json.loads(line.decode('utf-8'))
                    answer_chunk = result.get("response", "")
                    if answer_chunk:
                        buffer += answer_chunk
                        # 每累积 100 字符或流结束时发送
                        if len(buffer) >= 100 or result.get("done", False):
                            yield json.dumps({"answer": buffer, "score": 0.95}) + "\n"
                            logger.info(f"发送数据块: {buffer[:50]}..., 长度: {len(buffer)}, 时间: {datetime.now().isoformat()}")
                            buffer = ""
                    if result.get("done", False):
                        logger.info(f"流式响应完成，总耗时: {time.time() - start_time:.2f}s, 时间: {datetime.now().isoformat()}")
                        if buffer:
                            yield json.dumps({"answer": buffer, "score": 0.95}) + "\n"
                            logger.info(f"发送剩余数据块: {buffer[:50]}..., 长度: {len(buffer)}, 时间: {datetime.now().isoformat()}")
                        break
                except json.JSONDecodeError as e:
                    logger.error(f"JSON 解析错误: {e}, 原始数据: {line.decode('utf-8')}, 时间: {datetime.now().isoformat()}")
                    yield json.dumps({"answer": "抱歉，数据解析错误。", "score": 0.1}) + "\n"
                    break
    except requests.exceptions.Timeout:
        logger.error(f"Ollama API 超时，时间: {datetime.now().isoformat()}")
        yield json.dumps({"answer": "抱歉，服务器响应超时，请稍后重试。", "score": 0.1}) + "\n"
    except requests.exceptions.ConnectionError:
        logger.error(f"Ollama API 连接失败，时间: {datetime.now().isoformat()}")
        yield json.dumps({"answer": "抱歉，无法连接到模型服务，请检查服务器状态。", "score": 0.1}) + "\n"
    except Exception as e:
        logger.error(f"未预期的错误: {e}, 时间: {datetime.now().isoformat()}")
        yield json.dumps({"answer": "抱歉，系统发生未知错误，请联系管理员。", "score": 0.1}) + "\n"


@router.post("/")
async def question_answering(
    question: str = Form(...),
    user_id: int = Depends(get_current_user)
):
    start_time = time.time()
    request_id = str(int(time.time() * 1000))
    logger.info(f"收到问答请求: Question={question}, Request ID={request_id}, user_id={user_id}")

    async def stream_response():
        full_answer = ""
        try:
            async for chunk in call_ollama_stream(question):
                data = json.loads(chunk)
                full_answer += data["answer"]
                yield chunk
        except Exception as e:
            logger.error(f"流式问答处理失败: {e}")
            yield json.dumps({"answer": "抱歉，服务器内部错误，请稍后重试。", "score": 0.1})

        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO qa_history (request_id, user_id, question, answer, confidence, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        request_id,
                        user_id,
                        question,
                        full_answer,
                        0.95,
                        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    )
                )
                conn.commit()
                logger.info(f"保存问答历史记录到数据库: Request ID={request_id}, user_id={user_id}")
        except sqlite3.Error as e:
            logger.error(f"数据库保存失败: {e}")

        proc_time = time.time() - start_time
        logger.info(f"问答完成: Question={question} | 耗时: {proc_time:.2f}s | Request ID={request_id}")

    headers = {"X-Request-ID": request_id}
    return StreamingResponse(stream_response(), media_type="application/json", headers=headers)