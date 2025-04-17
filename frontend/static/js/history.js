import { API_ROUTES } from './config.js';
import { fetchWithAuth, accessToken } from './auth.js';
import { renderPagination, showLoginModal } from './ui.js';
import { updateDashboard, updateWastePieChart } from './dashboard.js';

let detectionPage = 1;
let qaPage = 1;
const perPage = 10;

async function loadDetectionHistory(search = '', page = detectionPage) {
    const historyContent = document.getElementById('detectionHistoryContent');
    try {
        const url = new URL(API_ROUTES.DETECTION_HISTORY);
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
                        <p><strong>Request ID:</strong LSE> ${record.request_id}</p>
                        <img class="history-image" src="${API_ROUTES.RESULT_IMAGE}/${record.request_id}" alt="检测结果图片">
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

async function loadQAHistory(search = '', page = qaPage) {
    const historyContent = document.getElementById('qaHistoryContent');
    try {
        const url = new URL(API_ROUTES.QA_HISTORY);
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

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

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

function addDeleteButtonListeners() {
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.removeEventListener('click', handleDelete);
        button.addEventListener('click', handleDelete);
    });
}

async function handleDelete(event) {
    const requestId = event.target.getAttribute('data-request-id');
    const historyType = event.target.getAttribute('data-history-type');
    if (confirm(`确定要删除 Request ID 为 ${requestId} 的记录吗？`)) {
        try {
            const response = await fetchWithAuth(`${API_ROUTES.DELETE_HISTORY}/${requestId}?history_type=${historyType}`, {
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

function searchDetectionHistory() {
    const searchTerm = document.getElementById('detection-search').value.trim();
    detectionPage = 1;
    loadDetectionHistory(searchTerm, detectionPage);
}

function searchQAHistory() {
    const searchTerm = document.getElementById('qa-search').value.trim();
    qaPage = 1;
    loadQAHistory(searchTerm, qaPage);
}

export { loadDetectionHistory, loadQAHistory, searchDetectionHistory, searchQAHistory };