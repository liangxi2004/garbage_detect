import { API_ROUTES } from './config.js';
import { fetchWithAuth, accessToken } from './auth.js';
import { showLoading, hideLoading, resetMediaElements, showLoginModal } from './ui.js';
import { updateDashboard, updateWastePieChart } from './dashboard.js';
import { loadDetectionHistory } from './history.js';

let originalVideo = document.getElementById('originalVideo');
let resultImage = document.getElementById('resultImage');
let originalImage = document.getElementById('originalImage');
let isDetecting = false;
let stream = null;
let lastFrameBlob = null;
let detectionMode = 'none';

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

function showResult(blob, message, requestId) {
    resetMediaElements();
    resultImage.src = URL.createObjectURL(blob);
    resultImage.style.width = '100%';
    resultImage.style.maxWidth = '640px';
    resultImage.style.height = 'auto';
    resultImage.style.objectFit = 'contain';
    resultImage.style.display = "block";

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

    if (!requestId || requestId === "null") {
        console.error("Invalid requestId, cannot fetch details");
        showResultDetails([]);
        return;
    }

    fetchWithAuth(`${API_ROUTES.DETECT_DETAILS}?request_id=${requestId}`)
        .then(response => response.json())
        .then(data => {
            console.log("Details response:", data);
            showResultDetails(data.detections);
            updateDashboard();
            updateWastePieChart();
        })
        .catch(error => {
            console.error(error);
            showResultDetails([]);
        });
}

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

async function stopCamera() {
    if (!stream) return;
    
    try {
        isDetecting = false;
        
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

        stream.getTracks().forEach(track => track.stop());
        originalVideo.srcObject = null;
        stream = null;

        if (lastFrameBlob) {
            const formData = new FormData();
            formData.append("file", lastFrameBlob);
            formData.append("save_to_history", "true");
            console.log("停止检测，保存最后一帧: save_to_history=true");

            const response = await fetchWithAuth(API_ROUTES.DETECT, {
                method: "POST",
                body: formData
            });

            const blob = await response.blob();
            const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
            showResult(blob, '检测完成', requestId);
            
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

        const response = await fetchWithAuth(API_ROUTES.DETECT, {
            method: "POST",
            body: formData
        });

        const resultBlob = await response.blob();
        const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
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

function setupDetectionListeners() {
    document.getElementById('imageInput').addEventListener('change', async function(e) {
        if (!accessToken) {
            showLoginModal();
            this.value = '';
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

            const response = await fetchWithAuth(API_ROUTES.DETECT, {
                method: "POST",
                body: formData
            });

            const blob = await response.blob();
            const requestId = response.headers.get('x-request-id') || response.headers.get('X-Request-ID');
            showResult(blob, '图片检测完成', requestId);
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

    document.getElementById('startCameraBtn').addEventListener('click', startCamera);
    document.getElementById('stopCameraBtn').addEventListener('click', stopCamera);
}

export { setupDetectionListeners };