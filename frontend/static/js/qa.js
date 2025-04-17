import { API_ROUTES } from './config.js';
import { fetchWithAuth, accessToken } from './auth.js';
import { showLoading, hideLoading, showLoginModal } from './ui.js';

let qaInput = document.getElementById('qaInput');
let qaSubmitBtn = document.getElementById('qaSubmitBtn');
let qaResult = document.getElementById('qaResult');

async function submitQuestion() {
    const question = qaInput.value.trim();
    if (!question) {
        alert('请输入问题！');
        return;
    }

    showLoading();
    qaResult.dataset.answer = '';
    qaResult.innerHTML = '';
    qaResult.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('question', question);

        const response = await fetchWithAuth(API_ROUTES.QA, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`问答请求失败: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let currentAnswer = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('流式读取完成，剩余 buffer:', buffer);
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            console.log('接收到数据块:', buffer);

            const parts = buffer.split(/(?<=})/);
            buffer = parts.pop() || '';

            for (const part of parts) {
                if (!part.trim()) continue;
                console.log('处理部分:', part);
                try {
                    const data = JSON.parse(part);
                    console.log('解析后的数据:', data);
                    if (data.answer) {
                        if (data.answer.includes('抱歉') || data.score < 0.5) {
                            console.warn('收到错误响应:', data.answer);
                            currentAnswer += data.answer;
                        } else {
                            const cleanAnswer = data.answer
                                .replace(/<\/?assistant>/g, '')
                                .replace(/\*\*/g, '');
                            currentAnswer += cleanAnswer;
                        }
                        console.log('当前答案:', currentAnswer);
                        await new Promise(resolve => setTimeout(resolve, 50));
                        showQAResult(currentAnswer, null, false);
                    } else {
                        console.warn('数据缺少 answer 字段:', data);
                    }
                } catch (parseError) {
                    console.error('解析 JSON 时出错:', parseError, '部分内容:', part);
                }
            }
        }

        if (buffer.trim()) {
            console.log('处理剩余 buffer:', buffer);
            try {
                const data = JSON.parse(buffer);
                console.log('剩余 buffer 解析结果:', data);
                if (data.answer) {
                    const cleanAnswer = data.answer
                        .replace(/<\/?assistant>/g, '')
                        .replace(/\*\*/g, '');
                    currentAnswer += cleanAnswer;
                }
            } catch (parseError) {
                console.error('解析剩余 buffer 时出错:', parseError);
            }
        }
    } catch (error) {
        console.error('问答请求错误:', error);
        qaResult.innerHTML = `<p class="error">问答失败: ${error.message}</p>`;
        qaResult.style.display = 'block';
    } finally {
        hideLoading();
    }
}

function showQAResult(answerChunk, confidence = null, isFinal = false) {
    try {
        const renderedAnswer = marked.parse(answerChunk);
        qaResult.innerHTML = `
            <div class="markdown-content">
                <strong>答案:</strong> <span>${renderedAnswer}</span>
            </div>
        `;
        qaResult.style.display = 'block';
        qaResult.scrollTop = qaResult.scrollHeight;
    } catch (error) {
        console.error('显示答案时出错:', error);
        qaResult.innerHTML = `<p class="error">显示答案时出错: ${error.message}</p>`;
        qaResult.style.display = 'block';
    }
}

function setupQAListeners() {
    qaSubmitBtn.addEventListener('click', () => {
        if (!accessToken) {
            showLoginModal();
        } else {
            submitQuestion();
        }
    });
}

export { setupQAListeners };