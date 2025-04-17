import { API_ROUTES } from './config.js';
import { fetchWithAuth, accessToken } from './auth.js';

const totalDetectionsEl = document.getElementById('totalDetections');
const dailyDetectionsEl = document.getElementById('dailyDetections');
const totalQAEl = document.getElementById('totalQA');
const wastePieChartEl = document.getElementById('wastePieChart');
let wastePieChart;

async function updateDashboard() {
    if (!accessToken) {
        console.log('未登录，跳过数据看板更新');
        return;
    }

    try {
        console.log('开始更新数据看板...');
        const response = await fetchWithAuth(API_ROUTES.STATS);
        const data = await response.json();
        console.log('数据看板统计数据:', data);

        if (totalDetectionsEl) {
            totalDetectionsEl.textContent = data.total_detections || 'N/A';
        }
        if (dailyDetectionsEl) {
            dailyDetectionsEl.textContent = data.daily_detections || 'N/A';
        }
        if (totalQAEl) {
            totalQAEl.textContent = data.total_qa || 'N/A';
        }

        const homePageDetections = document.getElementById('homePageDetections');
        const homePageUsers = document.getElementById('homePageUsers');
        if (homePageDetections && data.total_detections) {
            homePageDetections.textContent = `${data.total_detections}+`;
        }
        if (homePageUsers) {
            homePageUsers.textContent = '10,000+';
        }

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
    }
}

async function updateWastePieChart() {
    try {
        const response = await fetchWithAuth(API_ROUTES.WASTE_CATEGORIES);
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

export { updateDashboard, updateWastePieChart };