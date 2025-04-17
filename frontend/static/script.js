// 确保 API_BASE_URL 在最顶部定义
const API_BASE_URL = 'http://localhost:8000';

// 然后定义 API_ROUTES
const API_ROUTES = {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
    DETECT: `${API_BASE_URL}/detection/predict`,
    DETECT_DETAILS: `${API_BASE_URL}/detection/details`,
    DETECTION_HISTORY: `${API_BASE_URL}/db/detection_history`,
    QA: `${API_BASE_URL}/qa`,
    QA_HISTORY: `${API_BASE_URL}/db/qa_history`,
    DELETE_HISTORY: `${API_BASE_URL}/db/delete_history`,
    DELETE_ALL_HISTORY: `${API_BASE_URL}/db/delete_all_history`,
    STATS: `${API_BASE_URL}/db/stats`,
    WASTE_CATEGORIES: `${API_BASE_URL}/db/waste_categories`,
    KNOWLEDGE: `${API_BASE_URL}/db/knowledge`,
    RESULT_IMAGE: `${API_BASE_URL}/db/result_image`,
};

// 用户认证相关

let accessToken = localStorage.getItem('accessToken') || null;
let username = localStorage.getItem('username') || null;

// 获取 DOM 元素（检测页面）
let originalVideo = document.getElementById('originalVideo');
let resultImage = document.getElementById('resultImage');
let originalImage = document.getElementById('originalImage');
let isDetecting = false;
let stream = null;
let lastFrameBlob = null;
let detectionMode = 'none'; // 可选值: 'none', 'image', 'camera'

// 问答相关 DOM 元素
let qaInput = document.getElementById('qaInput');
let qaSubmitBtn = document.getElementById('qaSubmitBtn');
let qaResult = document.getElementById('qaResult');

// 数据看板 DOM 元素
const totalDetectionsEl = document.getElementById('totalDetections');
const dailyDetectionsEl = document.getElementById('dailyDetections');
const totalQAEl = document.getElementById('totalQA');

// 饼状图 DOM 元素
const wastePieChartEl = document.getElementById('wastePieChart');
let wastePieChart;

// 分页状态
let detectionPage = 1; // 当前检测历史页码
let qaPage = 1; // 当前问答历史页码
const perPage = 10; // 每页记录数

const detectionPageTotal = document.getElementById('detectionPageTotal'); // 首页
const detectionPageTotalDetect = document.getElementById('detectionPageTotalDetect'); // 检测页面

// 新增：检查登录状态
function checkLoginStatus() {
    console.log('检查登录状态:', { accessToken, username }); // 添加日志
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const userMenu = document.getElementById('userMenu');
    const usernameDisplay = document.getElementById('usernameDisplay');

    if (!loginBtn || !registerBtn || !userMenu || !usernameDisplay) {
        console.error('找不到用户界面元素');
        return;
    }

    if (accessToken && username) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        userMenu.style.display = 'flex';
        usernameDisplay.textContent = username;
        console.log('用户已登录:', username); // 添加日志
    } else {
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        userMenu.style.display = 'none';
        usernameDisplay.textContent = '';
        console.log('用户未登录'); // 添加日志
    }
}

// 新增：登出
function logout() {
    console.log('执行登出'); // 添加日志
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    accessToken = null;
    username = null;
    checkLoginStatus();
    alert('已登出');
    switchPage('home');
}

// 通用请求函数，自动添加令牌
async function fetchWithAuth(url, options = {}) {
    if (!accessToken) {
        console.log('未登录，显示登录模态框');
        showLoginModal();
        return Promise.reject(new Error('请先登录'));
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
    };

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            if (response.status === 401) {
                console.log('登录已过期，清除登录状态');
                logout();
                showLoginModal();
                throw new Error('登录已过期，请重新登录');
            }
            const errorData = await response.json();
            throw new Error(errorData.detail || `请求失败: ${response.status}`);
        }
        return response;
    } catch (error) {
        console.error('请求失败:', error);
        throw error;
    }
}


// 新增：显示登录模态框
function showLoginModal() {
    console.log('显示登录模态框'); // 添加日志
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'flex';
    } else {
        console.error('找不到登录模态框');
    }
}

// 新增：显示注册模态框
function showRegisterModal() {
    console.log('显示注册模态框'); // 添加日志
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'flex';
    } else {
        console.error('找不到注册模态框');
    }
}

// 新增：关闭模态框
function closeModal(modalId) {
    console.log('关闭模态框:', modalId); // 添加日志
    const modal = document.getElementById(modalId);
    const errorDisplay = document.getElementById(`${modalId.replace('Modal', 'Error')}`);
    
    if (modal) {
        modal.style.display = 'none';
    }
    if (errorDisplay) {
        errorDisplay.style.display = 'none';
    }
}

// 显示加载动画
function showLoading() {
    document.getElementById("loading").style.display = "block";
}

// 隐藏加载动画
function hideLoading() {
    document.getElementById("loading").style.display = "none";
}

// 重置媒体元素显示状态
function resetMediaElements() {
    // 设置统一的尺寸
    const elements = [resultImage, originalImage, originalVideo];
    elements.forEach(element => {
        element.style.width = '100%';
        element.style.maxWidth = '640px';
        element.style.height = 'auto';
        element.style.objectFit = 'contain';
        element.style.display = 'none';
    });
}

// 显示检测结果详情到表格并朗读结果
function showResultDetails(detections) {
    const tableBody = document.getElementById('resultTableBody');
    tableBody.innerHTML = '';

    if (!detections || detections.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">未检测到垃圾</td></tr>';
        return;
    }

    detections.forEach(detection => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${detection.class}</td>
            <td>${detection.confidence.toFixed(2)}</td>
            <td>${detection.action}</td>
            <td>${detection.timestamp || 'N/A'}</td>
        `;
        tableBody.appendChild(row);

        const utterance = new SpeechSynthesisUtterance(
            `检测到${detection.class}，置信度${detection.confidence.toFixed(2)}，${detection.action}`
        );
        utterance.lang = 'zh-CN';
        window.speechSynthesis.speak(utterance);
    });
}

// 显示检测结果图片和详情
function showResult(blob, message, requestId) {
    resetMediaElements();
    
    // 设置结果图片尺寸
    resultImage.src = URL.createObjectURL(blob);
    resultImage.style.width = '100%';
    resultImage.style.maxWidth = '640px';
    resultImage.style.height = 'auto';
    resultImage.style.objectFit = 'contain';
    resultImage.style.display = "block";
    
    // 根据检测模式显示原始画面
    if (detectionMode === 'image' && originalImage.src) {
        originalImage.style.width = '100%';
        originalImage.style.maxWidth = '640px';
        originalImage.style.height = 'auto';
        originalImage.style.objectFit = 'contain';
        originalImage.style.display = "block";
    } else if (detectionMode === 'camera' && originalVideo.srcObject) {
        originalVideo.style.width = '100%';
        originalVideo.style.maxWidth = '640px';
        originalVideo.style.height = 'auto';
        originalVideo.style.objectFit = 'contain';
        originalVideo.style.display = "block";
    }

    document.getElementById("result").textContent = message;

    console.log("Request ID:", requestId);

    if (!requestId || requestId === "null") {
        console.error("Invalid requestId, cannot fetch details");
        showResultDetails([]);
        return;
    }

    fetchWithAuth(`${API_BASE_URL}/detection/details?request_id=${requestId}`)
        .then(response => response.json())
        .then(data => {
            console.log("Details response:", data);
            showResultDetails(data.detections);
            // 在每次检测完成后更新数据看板
            updateDashboard();
            updateWastePieChart();
        })
        .catch(error => {
            console.error(error);
            showResultDetails([]);
        });
}


// // 提交问答请求（支持流式 Markdown 响应）
// async function submitQuestion() {
//     const question = qaInput.value.trim();
//     if (!question) {
//         alert('请输入问题！');
//         return;
//     }
//
//     showLoading();
//     const qaResult = document.getElementById('qaResult');
//     qaResult.dataset.answer = ''; // 清空上次答案
//     qaResult.innerHTML = ''; // 清空显示内容
//     qaResult.style.display = 'none';
//
//     try {
//         const formData = new FormData();
//         formData.append('question', question);
//
//         const response = await fetchWithAuth(`${API_BASE_URL}/qa`, {
//             method: 'POST',
//             body: formData
//         });
//
//         if (!response.ok) {
//             throw new Error(`问答请求失败: ${response.status}`);
//         }
//
//         // 获取原始响应文本
//         const responseText = await response.text();
//         console.log('原始响应:', responseText);
//
//         // 处理流式响应
//         const jsonObjects = responseText.match(/\{.*?\}/g) || [];
//         let currentAnswer = '';
//
//         for (const jsonStr of jsonObjects) {
//             try {
//                 const data = JSON.parse(jsonStr);
//                 if (data.answer) {
//                     // 清理当前片段的特殊标记
//                     const cleanAnswer = data.answer
//                         .replace(/<\/?assistant>/g, '')
//                         .replace(/\*\*/g, '');
//
//                     currentAnswer += cleanAnswer;
//                     // 实时显示当前答案
//                     showQAResult(currentAnswer, null, false);
//                 }
//             } catch (parseError) {
//                 console.error('解析单个JSON对象时出错:', parseError);
//             }
//         }
//
//         // 最终显示完整答案并触发语音播报
//         if (currentAnswer) {
//             showQAResult(currentAnswer.trim(), null, true);
//         } else {
//             throw new Error('未能获取有效答案');
//         }
//     } catch (error) {
//         console.error('问答请求错误:', error);
//         qaResult.innerHTML = `<p class="error">问答失败: ${error.message}</p>`;
//         qaResult.style.display = 'block';
//     } finally {
//         hideLoading();
//     }
// }
//
// // 显示问答结果（支持 Markdown 格式）
// function showQAResult(answerChunk, confidence = null, isFinal = false) {
//     const qaResult = document.getElementById('qaResult');
//
//     try {
//         // 使用 marked 解析 Markdown
//         const renderedAnswer = marked.parse(answerChunk);
//
//         // 更新 UI
//         qaResult.innerHTML = `
//             <div class="markdown-content">
//                 <strong>答案:</strong> ${renderedAnswer}
//             </div>
//         `;
//         qaResult.style.display = 'block';
//
//         // 仅在最终答案时触发语音播报
//         if (isFinal) {
//             const plainText = answerChunk
//                 .replace(/[#*`>\-+=|]/g, '') // 去除常见 Markdown 标记
//                 .replace(/\s+/g, ' ') // 规范化空格
//                 .trim();
//             const utterance = new SpeechSynthesisUtterance(`答案是：${plainText}`);
//             utterance.lang = 'zh-CN';
//             window.speechSynthesis.speak(utterance);
//         }
//     } catch (error) {
//         console.error('显示答案时出错:', error);
//         qaResult.innerHTML = `<p class="error">显示答案时出错: ${error.message}</p>`;
//         qaResult.style.display = 'block';
//     }
// }
async function submitQuestion() {
    const question = qaInput.value.trim();
    if (!question) {
        alert('请输入问题！');
        return;
    }

    showLoading();
    const qaResult = document.getElementById('qaResult');
    qaResult.dataset.answer = ''; // 清空上次答案
    qaResult.innerHTML = ''; // 清空显示内容
    qaResult.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('question', question);

        const response = await fetchWithAuth(`${API_BASE_URL}/qa`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`问答请求失败: ${response.status}`);
        }

        // 使用 ReadableStream 逐块处理流式响应
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

            // 解码当前块
            buffer += decoder.decode(value, { stream: true });
            console.log('接收到数据块:', buffer);

            // 按 JSON 对象分割（以 } 为边界，兼容无换行符的情况）
            const parts = buffer.split(/(?<=})/);
            buffer = parts.pop() || ''; // 保留未完成的部分

            for (const part of parts) {
                if (!part.trim()) continue; // 跳过空行
                console.log('处理部分:', part);
                try {
                    const data = JSON.parse(part);
                    console.log('解析后的数据:', data);
                    if (data.answer) {
                        // 处理错误响应
                        if (data.answer.includes('抱歉') || data.score < 0.5) {
                            console.warn('收到错误响应:', data.answer);
                            currentAnswer += data.answer;
                        } else {
                            // 清理当前片段的特殊标记
                            const cleanAnswer = data.answer
                                .replace(/<\/?assistant>/g, '')
                                .replace(/\*\*/g, '');
                            currentAnswer += cleanAnswer;
                        }
                        console.log('当前答案:', currentAnswer);
                        // 实时增量显示，添加延迟以突出流式效果
                        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms 延迟
                        showQAResult(currentAnswer, null, false);
                    } else {
                        console.warn('数据缺少 answer 字段:', data);
                    }
                } catch (parseError) {
                    console.error('解析 JSON 时出错:', parseError, '部分内容:', part);
                }
            }
        }

        // 处理剩余的 buffer
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

        // // 最终显示完整答案并触发语音播报
        // if (currentAnswer) {
        //     console.log('最终答案:', currentAnswer);
        //     showQAResult(currentAnswer.trim(), null, true);
        // } else {
        //     throw new Error('未能获取有效答案，可能的原因：服务器未返回 answer 字段、数据格式不正确或响应为空');
        // }
    } catch (error) {
        console.error('问答请求错误:', error);
        qaResult.innerHTML = `<p class="error">问答失败: ${error.message}</p>`;
        qaResult.style.display = 'block';
    } finally {
        hideLoading();
    }
}

// 显示问答结果（支持 Markdown 格式，增量更新）
function showQAResult(answerChunk, confidence = null, isFinal = false) {
    const qaResult = document.getElementById('qaResult');

    try {
        // 使用 marked 解析 Markdown
        const renderedAnswer = marked.parse(answerChunk);

        // 增量更新 UI
        qaResult.innerHTML = `
            <div class="markdown-content">
                <strong>答案:</strong> <span>${renderedAnswer}</span>
            </div>
        `;
        qaResult.style.display = 'block';

        // 自动滚动到最新内容
        qaResult.scrollTop = qaResult.scrollHeight;

        // // 仅在最终答案时触发语音播报
        // if (isFinal) {
        //     const plainText = answerChunk
        //         .replace(/[#*`>\-+=|]/g, '') // 去除常见 Markdown 标记
        //         .replace(/\s+/g, ' ') // 规范化空格
        //         .trim();
        //     const utterance = new SpeechSynthesisUtterance(`答案是：${plainText}`);
        //     utterance.lang = 'zh-CN';
        //     window.speechSynthesis.speak(utterance);
        // }
    } catch (error) {
        console.error('显示答案时出错:', error);
        qaResult.innerHTML = `<p class="error">显示答案时出错: ${error.message}</p>`;
        qaResult.style.display = 'block';
    }
}

// 启动摄像头并开始实时检测
async function startCamera() {
    if (!accessToken) {
        showLoginModal();
        return;
    }

    try {
        detectionMode = 'camera';
        resetMediaElements();
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        originalVideo.srcObject = stream;
        originalVideo.style.width = '100%';
        originalVideo.style.maxWidth = '640px';
        originalVideo.style.height = 'auto';
        originalVideo.style.objectFit = 'contain';
        originalVideo.style.display = "block";
        
        // 设置结果图像的大小与视频相同
        resultImage.style.width = '100%';
        resultImage.style.maxWidth = '640px';
        resultImage.style.height = 'auto';
        resultImage.style.objectFit = 'contain';
        
        originalImage.style.display = "none";
        originalVideo.play();
        isDetecting = true;
        detectFrame();
    } catch (err) {
        alert("无法访问摄像头: " + err.message);
    }
}

// 停止摄像头并保存最后一帧
async function stopCamera() {
    if (!stream) return;
    
    try {
        // 先停止检测
        isDetecting = false;
        
        // 确保最后一帧被正确捕获
        if (!lastFrameBlob) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = originalVideo.videoWidth;
            canvas.height = originalVideo.videoHeight;
            context.drawImage(originalVideo, 0, 0, canvas.width, canvas.height);
            
            lastFrameBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg');
            });
        }

        // 停止摄像头流
        stream.getTracks().forEach(track => track.stop());
        originalVideo.srcObject = null;
        stream = null;

        if (lastFrameBlob) {
            const formData = new FormData();
            formData.append("file", lastFrameBlob);
            formData.append("save_to_history", "true");
            console.log("停止检测，保存最后一帧: save_to_history=true");

            const response = await fetchWithAuth(`${API_BASE_URL}/detection/predict`, {
                method: "POST",
                body: formData
            });

            const blob = await response.blob();
            const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
            showResult(blob, '检测完成', requestId);
            
            // 更新历史记录
            if (accessToken) {
                loadDetectionHistory();
            }
        } else {
            throw new Error("无法捕获最后一帧");
        }
    } catch (error) {
        console.error(error);
        document.getElementById('result').textContent = '检测失败，请重试';
        showResultDetails([]);
    } finally {
        resetMediaElements();
        lastFrameBlob = null;
        detectionMode = 'none';
    }
}

// 加载垃圾分类知识
async function loadKnowledge() {
    const knowledgeContent = document.getElementById('knowledgeContent');
    try {
        const response = await fetch(`${API_BASE_URL}/db/knowledge`);
        if (!response.ok) {
            throw new Error(`获取知识失败: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();

        const categoryIcons = {
            '可回收物': '♻️',
            '有害垃圾': '⚠️',
            '湿垃圾': '🍎',
            '干垃圾': '🗑️'
        };

        const categoryMapping = {
            '可回收物': 'recyclable',
            '有害垃圾': 'hazardous',
            '湿垃圾': 'wet',
            '干垃圾': 'dry',
            '厨余垃圾': 'wet',
            '可回收垃圾': 'recyclable',
            '其他垃圾': 'dry'
        };

        let content = '';
        for (const [category, info] of Object.entries(data)) {
            const categoryKey = categoryMapping[category] || 'dry';
            content += `
                <div class="knowledge-card" data-category="${categoryKey}">
                    <div class="card-header">
                        <span class="card-icon">${categoryIcons[category] || '🗑️'}</span>
                        <h3>${category}</h3>
                    </div>
                    <div class="card-content">
                        <p><strong>描述:</strong> ${info.description}</p>
                        <button class="toggle-btn">查看详情</button>
                        <div class="card-details">
                            <p><strong>处理方法:</strong> ${info.handling}</p>
                            <p><strong>环保意义:</strong> ${info.environmental_impact}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        knowledgeContent.innerHTML = content;

        document.querySelectorAll('.knowledge-card').forEach(card => {
            card.style.display = 'block';
        });

        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const category = button.getAttribute('data-category');
                document.querySelectorAll('.knowledge-card').forEach(card => {
                    if (category === 'all' || card.getAttribute('data-category') === category) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });

        document.querySelectorAll('.toggle-btn').forEach(button => {
            button.addEventListener('click', () => {
                const details = button.nextElementSibling;
                const isOpen = details.style.display === 'block';
                details.style.display = isOpen ? 'none' : 'block';
                button.textContent = isOpen ? '查看详情' : '收起详情';
            });
        });
    } catch (error) {
        console.error('加载知识库失败:', error);
        knowledgeContent.innerHTML = `获取知识失败: ${error.message}`;
    }
}

// 渲染分页导航
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const pagination = document.getElementById(`${containerId}-pagination`) || document.createElement('div');
    pagination.id = `${containerId}-pagination`;
    pagination.className = 'pagination';
    pagination.innerHTML = ''; // 清空现有内容

    let content = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 上一页按钮
    content += `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}">
            上一页
        </button>
    `;

    // 页码按钮
    for (let i = startPage; i <= endPage; i++) {
        content += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}">
                ${i}
            </button>
        `;
    }

    // 下一页按钮
    content += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}">
            下一页
        </button>
    `;

    pagination.innerHTML = content;

    // 动态绑定点击事件
    const buttons = pagination.querySelectorAll('.pagination-btn');
    buttons.forEach(button => {
        const text = button.textContent.trim();
        if (text === '上一页' && currentPage > 1) {
            button.addEventListener('click', () => onPageChange(currentPage - 1));
        } else if (text === '下一页' && currentPage < totalPages) {
            button.addEventListener('click', () => onPageChange(currentPage + 1));
        } else if (/^\d+$/.test(text)) {
            const pageNum = parseInt(text);
            button.addEventListener('click', () => onPageChange(pageNum));
        }
    });

    const contentContainer = document.getElementById(containerId);
    if (!pagination.parentElement) {
        contentContainer.insertAdjacentElement('afterend', pagination);
    }
}

// 加载检测历史记录
async function loadDetectionHistory(search = '', page = detectionPage) {
    const historyContent = document.getElementById('detectionHistoryContent');
    try {
        const url = new URL(`${API_BASE_URL}/db/detection_history`);
        if (search) url.searchParams.append('search', search);
        url.searchParams.append('page', page);
        url.searchParams.append('per_page', perPage);
        const response = await fetchWithAuth(url);
        const data = await response.json();

        detectionPage = page;
        let content = '';
        if (data.history.length === 0) {
            content = '<p class="no-results">无匹配的检测记录</p>';
        } else {
            data.history.forEach(record => {
                content += `
                    <div class="history-record">
                        <h4>文件: ${record.filename}</h4>
                        <p><strong>Request ID:</strong> ${record.request_id}</p>
                        <img class="history-image" src="${API_BASE_URL}/db/result_image/${record.request_id}" alt="检测结果图片">
                        <table>
                            <thead>
                                <tr>
                                    <th>垃圾类型</th>
                                    <th>置信度</th>
                                    <th>推荐操作</th>
                                    <th>检测时间</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                record.detections.forEach(detection => {
                    content += `
                        <tr>
                            <td>${detection.class}</td>
                            <td>${detection.confidence.toFixed(2)}</td>
                            <td>${detection.action}</td>
                            <td>${detection.timestamp}</td>
                        </tr>
                    `;
                });
                content += `
                            </tbody>
                        </table>
                        <button class="delete-btn" data-request-id="${record.request_id}" data-history-type="detection">删除记录</button>
                        <hr>
                    </div>
                `;
            });
        }
        historyContent.innerHTML = content;

        const totalPages = data.total_pages || 1;
        renderPagination('detectionHistoryContent', detectionPage, totalPages, page => {
            loadDetectionHistory(search, page);
        });

        addDeleteButtonListeners();
    } catch (error) {
        console.error(error);
        historyContent.innerHTML = '<p class="error">获取检测历史记录失败，请重试</p>';
        document.getElementById('detectionHistoryContent-pagination')?.remove();
    }
}

// 加载问答历史记录
async function loadQAHistory(search = '', page = qaPage) {
    const historyContent = document.getElementById('qaHistoryContent');
    try {
        const url = new URL(`${API_BASE_URL}/db/qa_history`);  // 修改为 /db/qa_history
        if (search) url.searchParams.append('search', search);
        url.searchParams.append('page', page);
        url.searchParams.append('per_page', perPage);
        const response = await fetchWithAuth(url);
        const data = await response.json();

        qaPage = page;
        historyContent.innerHTML = '';

        if (data.history.length === 0) {
            historyContent.innerHTML = '<p class="no-results">无匹配的问答记录</p>';
            document.getElementById('qaHistoryContent-pagination')?.remove();
        } else {
            data.history.forEach(record => {
                const renderedAnswer = marked.parse(record.answer);
                const plainAnswer = record.answer
                    .replace(/[#*`>\-+=|]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                const previewText = truncateText(plainAnswer, 100);
                const isLongAnswer = plainAnswer.length > 100;

                const historyItem = document.createElement('div');
                historyItem.className = 'qa-history-item';
                historyItem.innerHTML = `
                    <div class="question">${record.question}</div>
                    <div class="answer-container">
                        <div class="answer-preview">${marked.parse(previewText)}</div>
                        <div class="answer-full">${renderedAnswer}</div>
                        ${isLongAnswer ? `<button class="toggle-btn" data-request-id="${record.request_id}">查看详情</button>` : ''}
                    </div>
                    <div class="meta-info">
                        <p><strong>Request ID:</strong> ${record.request_id}</p>
                        <p><strong>置信度:</strong> ${record.confidence.toFixed(2)}</p>
                        <p><strong>时间:</strong> ${record.timestamp}</p>
                    </div>
                    <button class="delete-btn" data-request-id="${record.request_id}" data-history-type="qa">删除记录</button>
                `;
                historyContent.appendChild(historyItem);
            });

            document.querySelectorAll('.toggle-btn').forEach(button => {
                button.addEventListener('click', toggleAnswer);
            });

            addDeleteButtonListeners();

            const totalPages = data.total_pages || 1;
            renderPagination('qaHistoryContent', qaPage, totalPages, page => {
                loadQAHistory(search, page);
            });
        }
    } catch (error) {
        console.error(error);
        historyContent.innerHTML = '<p class="error">获取问答历史记录失败，请重试</p>';
        document.getElementById('qaHistoryContent-pagination')?.remove();
    }
}

// 截断文本函数
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

// 展开/收起答案
function toggleAnswer(event) {
    const button = event.target;
    const historyItem = button.closest('.qa-history-item');
    const isExpanded = historyItem.classList.contains('expanded');

    if (isExpanded) {
        historyItem.classList.remove('expanded');
        button.textContent = '查看详情';
    } else {
        historyItem.classList.add('expanded');
        button.textContent = '收起';
    }
}

// 搜索检测历史
function searchDetectionHistory() {
    const searchTerm = document.getElementById('detection-search').value.trim();
    detectionPage = 1; // 重置页码
    loadDetectionHistory(searchTerm, detectionPage);
}

// 搜索问答历史
function searchQAHistory() {
    const searchTerm = document.getElementById('qa-search').value.trim();
    qaPage = 1; // 重置页码
    loadQAHistory(searchTerm, qaPage);
}

// 添加删除按钮监听器
function addDeleteButtonListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.removeEventListener('click', handleDelete); // 防止重复绑定
        button.addEventListener('click', handleDelete);
    });
}

// 处理删除历史记录
async function handleDelete(event) {
    const requestId = event.target.getAttribute('data-request-id');
    const historyType = event.target.getAttribute('data-history-type');
    if (confirm(`确定要删除 Request ID 为 ${requestId} 的记录吗？`)) {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/db/delete_history/${requestId}?history_type=${historyType}`, {  // 修改为 /db/delete_history
                method: 'DELETE'
            });
            const result = await response.json();
            alert(result.message);
            if (historyType === 'detection') {
                loadDetectionHistory(document.getElementById('detection-search').value.trim(), detectionPage);
            } else {
                loadQAHistory(document.getElementById('qa-search').value.trim(), qaPage);
            }
            updateDashboard();
            updateWastePieChart();
        } catch (error) {
            console.error(error);
            alert('删除失败，请重试');
        }
    }
}


// 更新数据看板
async function updateDashboard() {
    if (!accessToken) {
        console.log('未登录，跳过数据看板更新');
        return;
    }

    try {
        console.log('开始更新数据看板...');
        const response = await fetchWithAuth(`${API_BASE_URL}/db/stats`);
        const data = await response.json();
        console.log('数据看板统计数据:', data);

        // 更新检测页面的数据看板
        const totalDetectionsEl = document.getElementById('totalDetections');
        const dailyDetectionsEl = document.getElementById('dailyDetections');
        const totalQAEl = document.getElementById('totalQA');

        if (totalDetectionsEl) {
            totalDetectionsEl.textContent = data.total_detections || 'N/A';
        }
        if (dailyDetectionsEl) {
            dailyDetectionsEl.textContent = data.daily_detections || 'N/A';
        }
        if (totalQAEl) {
            totalQAEl.textContent = data.total_qa || 'N/A';
        }

        // 更新首页的统计数据
        const homePageDetections = document.getElementById('homePageDetections');
        const homePageUsers = document.getElementById('homePageUsers');
        if (homePageDetections && data.total_detections) {
            homePageDetections.textContent = `${data.total_detections}+`;
        }
        if (homePageUsers) {
            homePageUsers.textContent = '10,000+';
        }

        // 更新 detectionPageTotal 和 detectionPageTotalDetect
        const detectionPageTotal = document.getElementById('detectionPageTotal');
        const detectionPageTotalDetect = document.getElementById('detectionPageTotalDetect');
        if (detectionPageTotal) {
            detectionPageTotal.textContent = data.total_detections || 'N/A';
        }
        if (detectionPageTotalDetect) {
            detectionPageTotalDetect.textContent = data.total_detections || 'N/A';
        }

    } catch (error) {
        console.error('更新数据看板失败:', error);
        // 不显示错误提示，避免干扰用户体验
    }
}

// 更新饼状图
async function updateWastePieChart() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/db/waste_categories`);  // 修改为 /db/waste_categories
        const data = await response.json();

        const labels = data.map(item => item.category);
        const values = data.map(item => item.count);

        if (wastePieChart) {
            wastePieChart.destroy();
        }

        wastePieChart = new Chart(wastePieChartEl, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#00C853',
                        '#0091EA',
                        '#FF4D4F',
                        '#FFC107',
                        '#9C27B0',
                    ],
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: '垃圾分类分布'
                    }
                }
            }
        });
    } catch (error) {
        console.error('更新饼状图失败:', error);
    }
}

// 停止语音播报
function stopSpeech() {
    window.speechSynthesis.cancel();
}

// 页面切换
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.classList.remove('active');
    });

    document.getElementById(pageId).classList.add('active');

    const navBtn = document.querySelector(`.status-btn[data-page="${pageId}"]`);
    const dropdownItem = document.querySelector(`.dropdown-item[data-page="${pageId}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    } else if (dropdownItem) {
        dropdownItem.classList.add('active');
        document.querySelector('.dropdown-toggle').classList.add('active');
    }

    if (pageId === 'detection') {
        updateDashboard();
        updateWastePieChart();
    } else if (pageId === 'knowledge') {
        loadKnowledge();
    } else if (pageId === 'detection-history') {
        if (accessToken) {
            detectionPage = 1; // 重置页码
            loadDetectionHistory();
        } else {
            showLoginModal();
        }
    } else if (pageId === 'qa-history') {
        if (accessToken) {
            qaPage = 1; // 重置页码
            loadQAHistory();
        } else {
            showLoginModal();
        }
    } else if (pageId === 'qa') {
        qaResult.style.display = 'none';
    }
}

// 实时检测视频帧
async function detectFrame() {
    if (!isDetecting) return;

    try {
        showLoading();
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = originalVideo.videoWidth;
        canvas.height = originalVideo.videoHeight;
        context.drawImage(originalVideo, 0, 0, canvas.width, canvas.height);

        lastFrameBlob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg');
        });

        const formData = new FormData();
        formData.append("file", lastFrameBlob);
        formData.append("save_to_history", "false");
        console.log("实时检测: save_to_history=false");

        const response = await fetchWithAuth(`${API_BASE_URL}/detection/predict`, {
            method: "POST",
            body: formData
        });

        const resultBlob = await response.blob();
        const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
        console.log("Response headers:", response.headers);
        showResult(resultBlob, '实时检测中...', requestId);
    } catch (error) {
        console.error(error);
        document.getElementById('result').textContent = '实时检测失败';
        showResultDetails([]);
    } finally {
        hideLoading();
        if (isDetecting) setTimeout(detectFrame, 500);
    }
}

// 上传图片并检测
document.getElementById('imageInput').addEventListener('change', async function(e) {
    if (!accessToken) {
        showLoginModal();
        this.value = ''; // 清空文件输入
        return;
    }

    if (!this.files[0]) return;

    detectionMode = 'image';
    resetMediaElements();
    showLoading();
    const file = this.files[0];

    originalImage.style.display = "block";
    originalImage.src = URL.createObjectURL(file);
    originalVideo.style.display = "none";

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("save_to_history", "true");
        console.log("图片检测: save_to_history=true");

        const response = await fetchWithAuth(`${API_BASE_URL}/detection/predict`, {
            method: "POST",
            body: formData
        });

        const blob = await response.blob();
        const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
        console.log("Response headers:", response.headers);
        showResult(blob, '图片检测完成', requestId);
        // 检测完成后更新数据看板
        updateDashboard();
    } catch (error) {
        console.error(error);
        document.getElementById('result').textContent = '检测失败，请重试';
        showResultDetails([]);
    } finally {
        hideLoading();
        this.value = '';
    }
});

// 新增：用户认证事件监听器
function setupAuthListeners() {
    console.log('设置认证监听器'); // 添加日志

    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeButtons = document.querySelectorAll('.modal .close');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // 登录按钮点击事件
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            console.log('点击登录按钮');
            showLoginModal();
        });
    } else {
        console.error('找不到 loginBtn');
    }

    // 注册按钮点击事件
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            console.log('点击注册按钮');
            showRegisterModal();
        });
    } else {
        console.error('找不到 registerBtn');
    }

    // 登出按钮点击事件
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error('找不到 logoutBtn');
    }

    // 关闭按钮点击事件
    closeButtons.forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeModal(closeBtn.closest('.modal').id);
        });
    });

    // 登录表单提交事件
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('登录表单已提交'); // 添加日志
            const usernameInput = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const errorDisplay = document.getElementById('loginError');

            console.log('用户名:', usernameInput, '密码:', password); // 添加日志

            try {
                const formData = new FormData();
                formData.append('username', usernameInput);
                formData.append('password', password);

                console.log('发送登录请求到:', `${API_BASE_URL}/auth/login`); // 添加日志
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });

                console.log('登录请求状态:', response.status); // 添加日志
                console.log('响应头:', response.headers); // 添加日志

                if (!response.ok) {
                    const errorData = await response.json();
                    console.log('登录失败，错误信息:', errorData); // 添加日志
                    throw new Error(errorData.detail || '登录失败');
                }

                const data = await response.json();
                console.log('登录响应数据:', data); // 添加日志
                
                if (!data.access_token) {
                    throw new Error('登录响应中没有访问令牌');
                }

                accessToken = data.access_token;
                username = usernameInput;
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('username', username);

                console.log('登录成功:', username);

                // 更新UI状态
                checkLoginStatus();
                closeModal('loginModal');
                alert('登录成功');

                // 更新数据看板
                updateDashboard();

                // 切换到当前页面
                const currentPage = document.querySelector('.page.active').id;
                switchPage(currentPage);
            } catch (error) {
                console.error('登录错误:', error);
                if (errorDisplay) {
                    errorDisplay.textContent = error.message || '服务器错误，请稍后重试';
                    errorDisplay.style.display = 'block';
                } else {
                    console.error('找不到 errorDisplay 元素');
                }
            }
        });
    } else {
        console.error('找不到 loginForm');
    }

    // 注册表单提交事件（保持不变）
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            const errorDisplay = document.getElementById('registerError');

            try {
                const formData = new FormData();
                formData.append('username', usernameInput);
                formData.append('password', password);

                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || '注册失败');
                }

                const data = await response.json();
                console.log('注册成功');
                closeModal('registerModal');
                alert('注册成功，请登录');
                showLoginModal();
            } catch (error) {
                console.error('注册错误:', error);
                errorDisplay.textContent = error.message || '服务器错误，请稍后重试';
                errorDisplay.style.display = 'block';
            }
        });
    } else {
        console.error('找不到 registerForm');
    }
}

// 事件监听器
document.getElementById('startCameraBtn').addEventListener('click', startCamera);
document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
document.getElementById('stopSpeechBtn').addEventListener('click', stopSpeech);
qaSubmitBtn.addEventListener('click', () => {
    if (!accessToken) {
        showLoginModal();
    } else {
        submitQuestion();
    }
});

document.getElementById('deleteAllHistoryBtn').addEventListener('click', async () => {
    if (!accessToken) {
        showLoginModal();
        return;
    }

    if (confirm('确定要删除所有历史记录吗？此操作不可恢复！')) {
        try {
            showLoading();
            const response = await fetchWithAuth(`${API_BASE_URL}/db/delete_all_history`, {  // 修改为 /db/delete_all_history
                method: 'DELETE'
            });

            const result = await response.json();
            alert(result.message);
            document.getElementById('detectionHistoryContent').innerHTML = '<p class="no-results">暂无检测历史记录</p>';
            document.getElementById('qaHistoryContent').innerHTML = '<p class="no-results">暂无问答历史记录</p>';
            document.getElementById('detectionHistoryContent-pagination')?.remove();
            document.getElementById('qaHistoryContent-pagination')?.remove();
            updateDashboard();
            updateWastePieChart();
        } catch (error) {
            console.error('删除全部历史记录失败:', error);
            alert('删除全部历史记录失败: ' + error.message);
        } finally {
            hideLoading();
        }
    }
});

// 状态栏按钮事件
document.querySelectorAll('.status-btn[data-page], .dropdown-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
        const pageId = btn.getAttribute('data-page');
        switchPage(pageId);
    });
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，开始初始化...');
    
    // 检查登录状态
    checkLoginStatus();
    
    // 设置认证监听器
    setupAuthListeners();
    
    // 切换到首页
    switchPage('home');
    
    // 如果已登录，更新数据看板
    if (accessToken) {
        console.log('用户已登录，更新数据看板...');
        updateDashboard();
    } else {
        console.log('用户未登录，跳过数据看板更新');
    }

    // 添加搜索事件监听器
    const detectionSearch = document.getElementById('detection-search');
    const qaSearch = document.getElementById('qa-search');
    
    if (detectionSearch) {
        detectionSearch.addEventListener('keypress', e => {
            if (e.key === 'Enter') searchDetectionHistory();
        });
    }
    
    if (qaSearch) {
        qaSearch.addEventListener('keypress', e => {
            if (e.key === 'Enter') searchQAHistory();
        });
    }
});