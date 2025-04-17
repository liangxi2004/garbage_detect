import { API_ROUTES } from './config.js';

let accessToken = localStorage.getItem('accessToken') || null;
let username = localStorage.getItem('username') || null;

function checkLoginStatus() {
    console.log('检查登录状态:', { accessToken, username });
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
        console.log('用户已登录:', username);
    } else {
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'block';
        userMenu.style.display = 'none';
        usernameDisplay.textContent = '';
        console.log('用户未登录');
    }
}

function logout() {
    console.log('执行登出');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    accessToken = null;
    username = null;
    checkLoginStatus();
    alert('已登出');
    switchPage('home'); // 需从 ui.js 导入
}

async function fetchWithAuth(url, options = {}) {
    if (!accessToken) {
        console.log('未登录，显示登录模态框');
        showLoginModal(); // 需从 ui.js 导入
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

function setupAuthListeners(switchPage, showLoginModal, showRegisterModal, closeModal) {
    console.log('设置认证监听器');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeButtons = document.querySelectorAll('.modal .close');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            console.log('点击登录按钮');
            showLoginModal();
        });
    } else {
        console.error('找不到 loginBtn');
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            console.log('点击注册按钮');
            showRegisterModal();
        });
    } else {
        console.error('找不到 registerBtn');
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    } else {
        console.error('找不到 logoutBtn');
    }

    closeButtons.forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            closeModal(closeBtn.closest('.modal').id);
        });
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('登录表单已提交');
            const usernameInput = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const errorDisplay = document.getElementById('loginError');

            try {
                const formData = new FormData();
                formData.append('username', usernameInput);
                formData.append('password', password);

                console.log('发送登录请求到:', API_ROUTES.LOGIN);
                const response = await fetch(API_ROUTES.LOGIN, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || '登录失败');
                }

                const data = await response.json();
                if (!data.access_token) {
                    throw new Error('登录响应中没有访问令牌');
                }

                accessToken = data.access_token;
                username = usernameInput;
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('username', username);

                console.log('登录成功:', username);
                checkLoginStatus();
                closeModal('loginModal');
                alert('登录成功');
                switchPage(document.querySelector('.page.active').id);
            } catch (error) {
                console.error('登录错误:', error);
                if (errorDisplay) {
                    errorDisplay.textContent = error.message || '服务器错误，请稍后重试';
                    errorDisplay.style.display = 'block';
                }
            }
        });
    }

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

                const response = await fetch(API_ROUTES.REGISTER, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || '注册失败');
                }

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
    }
}

export { checkLoginStatus, logout, fetchWithAuth, setupAuthListeners, accessToken };