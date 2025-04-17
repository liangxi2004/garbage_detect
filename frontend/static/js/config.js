const API_BASE_URL = 'http://localhost:8000';

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

export { API_BASE_URL, API_ROUTES };