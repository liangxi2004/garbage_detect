import { loadKnowledge } from './knowledge.js';
import { loadDetectionHistory, loadQAHistory } from './history.js';
import { updateDashboard, updateWastePieChart } from './dashboard.js';
import { accessToken } from './auth.js';
import { showLoginModal } from './auth.js'; // 确保导入

function showLoading() {
    document.getElementById("loading").style.display = "block";
}

function hideLoading() {
    document.getElementById("loading").style.display = "none";
}

function resetMediaElements() {
    const elements = [
        document.getElementById('resultImage'),
        document.getElementById('originalImage'),
        document.getElementById('originalVideo')
    ];
    elements.forEach(element => {
        element.style.width = '100%';
        element.style.maxWidth = '640px';
        element.style.height = 'auto';
        element.style.objectFit = 'contain';
        element.style.display = 'none';
    });
}

function showLoginModal() {
    console.log('显示登录模态框');
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'flex';
    } else {
        console.error('找不到登录模态框');
    }
}

function showRegisterModal() {
    console.log('显示注册模态框');
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'flex';
    } else {
        console.error('找不到注册模态框');
    }
}

function closeModal(modalId) {
    console.log('关闭模态框:', modalId);
    const modal = document.getElementById(modalId);
    const errorDisplay = document.getElementById(`${modalId.replace('Modal', 'Error')}`);
    
    if (modal) {
        modal.style.display = 'none';
    }
    if (errorDisplay) {
        errorDisplay.style.display = 'none';
    }
}

function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const pagination = document.getElementById(`${containerId}-pagination`) || document.createElement('div');
    pagination.id = `${containerId}-pagination`;
    pagination.className = 'pagination';
    pagination.innerHTML = '';

    let content = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    content += `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}">
            上一页
        </button>
    `;

    for (let i = startPage; i <= endPage; i++) {
        content += `
            <button class="pagination-btn ${i === currentPage ? 'active' : ''}">
                ${i}
            </button>
        `;
    }

    content += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}">
            下一页
        </button>
    `;

    pagination.innerHTML = content;

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
            loadDetectionHistory();
        } else {
            showLoginModal();
        }
    } else if (pageId === 'qa-history') {
        if (accessToken) {
            loadQAHistory();
        } else {
            showLoginModal();
        }
    } else if (pageId === 'qa') {
        document.getElementById('qaResult').style.display = 'none';
    }
}

function stopSpeech() {
    window.speechSynthesis.cancel();
}

export { showLoading, hideLoading, resetMediaElements, showLoginModal, showRegisterModal, closeModal, renderPagination, switchPage, stopSpeech };