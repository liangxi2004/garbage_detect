import { checkLoginStatus, setupAuthListeners } from './auth.js';
import { setupDetectionListeners } from './detection.js';
import { setupQAListeners } from './qa.js';
import { searchDetectionHistory, searchQAHistory } from './history.js';
import { updateDashboard } from './dashboard.js';
import { switchPage, stopSpeech, showLoginModal } from './ui.js';
import { fetchWithAuth, accessToken } from './auth.js';
import { API_ROUTES } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成，开始初始化...');

    // 检查登录状态
    checkLoginStatus();
    setupAuthListeners(switchPage, showLoginModal, showRegisterModal, closeModal);
    setupDetectionListeners();
    setupQAListeners();

    // 初始化页面
    switchPage('home');

    if (accessToken) {
        console.log('用户已登录，更新数据看板...');
        updateDashboard();
    } else {
        console.log('用户未登录，跳过数据看板更新');
    }

    // 绑定搜索按钮事件
    const detectionSearchBtn = document.getElementById('detectionSearchBtn');
    const qaSearchBtn = document.getElementById('qaSearchBtn');

    if (detectionSearchBtn) {
        console.log('找到 detectionSearchBtn，绑定事件...');
        detectionSearchBtn.addEventListener('click', () => {
            console.log('点击了检测历史搜索按钮');
            searchDetectionHistory();
        });
    } else {
        console.error('未找到 detectionSearchBtn');
    }

    if (qaSearchBtn) {
        console.log('找到 qaSearchBtn，绑定事件...');
        qaSearchBtn.addEventListener('click', () => {
            console.log('点击了问答历史搜索按钮');
            searchQAHistory();
        });
    } else {
        console.error('未找到 qaSearchBtn');
    }

    // 绑定首页按钮事件
    const startDetectionBtn = document.getElementById('startDetectionBtn');
    const startDetectionFooterBtn = document.getElementById('startDetectionFooterBtn');
    const learnMoreBtn = document.getElementById('learnMoreBtn');

    if (startDetectionBtn) {
        console.log('找到 startDetectionBtn，绑定事件...');
        startDetectionBtn.addEventListener('click', () => {
            console.log('点击了开始检测按钮');
            switchPage('detection');
        });
    } else {
        console.error('未找到 startDetectionBtn');
    }

    if (startDetectionFooterBtn) {
        console.log('找到 startDetectionFooterBtn，绑定事件...');
        startDetectionFooterBtn.addEventListener('click', () => {
            console.log('点击了立即开始按钮');
            switchPage('detection');
        });
    } else {
        console.error('未找到 startDetectionFooterBtn');
    }

    if (learnMoreBtn) {
        console.log('找到 learnMoreBtn，绑定事件...');
        learnMoreBtn.addEventListener('click', () => {
            console.log('点击了了解更多按钮');
            window.location.href = '#features';
        });
    } else {
        console.error('未找到 learnMoreBtn');
    }

    // 绑定导航栏按钮
    document.querySelectorAll('.status-btn[data-page], .dropdown-item[data-page]').forEach(btn => {
        console.log('为导航按钮绑定事件:', btn.getAttribute('data-page'));
        btn.addEventListener('click', () => {
            const pageId = btn.getAttribute('data-page');
            console.log(`点击了导航按钮，切换到页面: ${pageId}`);
            switchPage(pageId);
        });
    });

    // 绑定其他按钮
    const stopSpeechBtn = document.getElementById('stopSpeechBtn');
    if (stopSpeechBtn) {
        console.log('找到 stopSpeechBtn，绑定事件...');
        stopSpeechBtn.addEventListener('click', () => {
            console.log('点击了结束语音按钮');
            stopSpeech();
        });
    } else {
        console.error('未找到 stopSpeechBtn');
    }

    const deleteAllHistoryBtn = document.getElementById('deleteAllHistoryBtn');
    if (deleteAllHistoryBtn) {
        console.log('找到 deleteAllHistoryBtn，绑定事件...');
        deleteAllHistoryBtn.addEventListener('click', async () => {
            console.log('点击了删除全部历史记录按钮');
            if (!accessToken) {
                showLoginModal();
                return;
            }

            if (confirm('确定要删除所有历史记录吗？此操作不可恢复！')) {
                try {
                    showLoading();
                    const response = await fetchWithAuth(API_ROUTES.DELETE_ALL_HISTORY, {
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
    } else {
        console.error('未找到 deleteAllHistoryBtn');
    }

    // 绑定搜索输入框的 keypress 事件
    const detectionSearch = document.getElementById('detection-search');
    const qaSearch = document.getElementById('qa-search');

    if (detectionSearch) {
        console.log('找到 detection-search，绑定 keypress 事件...');
        detectionSearch.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                console.log('检测历史搜索输入框按下 Enter');
                searchDetectionHistory();
            }
        });
    } else {
        console.error('未找到 detection-search');
    }

    if (qaSearch) {
        console.log('找到 qa-search，绑定 keypress 事件...');
        qaSearch.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                console.log('问答历史搜索输入框按下 Enter');
                searchQAHistory();
            }
        });
    } else {
        console.error('未找到 qa-search');
    }
});