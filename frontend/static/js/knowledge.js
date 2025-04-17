import { API_ROUTES } from './config.js';

async function loadKnowledge() {
    const knowledgeContent = document.getElementById('knowledgeContent');
    try {
        const response = await fetch(API_ROUTES.KNOWLEDGE);
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

export { loadKnowledge };