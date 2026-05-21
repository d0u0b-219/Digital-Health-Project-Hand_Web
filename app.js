// ==========================================
// 1. 模組引入與全域狀態
// ==========================================
import { initPalmarGame, drawPalmarGame, checkPalmarLogic } from './game_palmar.js';
import { initPincerGame, drawPincerGame, checkPincerLogic } from './game_pincer.js';
import { initNumbersGame, drawNumbersGame, checkNumbersLogic } from './game_numbers.js';

let gameState = { 
    isPlaying: false, gameType: 'palmar', handUsed: 'right', difficulty: 'easy', 
    currentReport: null, currentUser: { id: '', name: '' } 
};

const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const webcam = document.getElementById('webcam');

let mockDatabase = [ { id: 'P-001', name: '王大明', age: 25, job: '學生' }, { id: 'User-A', name: '林小姐', age: 30, job: '上班族' } ];

window.showSection = function(sectionId) {
    const list = ['welcomeBox', 'loginBox', 'registerBox', 'gameSelectionBox', 'gameSettingsBox', 'pincerPreviewBox', 'gameArea', 'endReportBox'];
    list.forEach(id => {
        if(id === 'gameArea') document.getElementById(id).style.display = (id === sectionId) ? 'flex' : 'none';
        else document.getElementById(id).style.display = (id === sectionId) ? 'block' : 'none';
    });
    document.getElementById('mainTitle').style.display = (sectionId === 'gameArea') ? 'none' : 'block';
};

// 帳號登入與註冊邏輯
document.getElementById('registerBtn').addEventListener('click', () => {
    const regName = document.getElementById('regName').value.trim();
    const regId = document.getElementById('regId').value.trim();
    if (!regName || !regId) return document.getElementById('regMsg').innerText = "暱稱與 ID 為必填！";
    if (mockDatabase.find(user => user.id === regId)) return document.getElementById('regMsg').innerText = "此 ID 已被使用！";
    mockDatabase.push({ id: regId, name: regName });
    gameState.currentUser = { id: regId, name: regName };
    updateUserDisplays(); showSection('gameSelectionBox');
});
document.getElementById('searchBtn').addEventListener('click', () => {
    const searchName = document.getElementById('searchName').value.trim();
    const resultList = document.getElementById('resultList');
    if (!searchName) return;
    resultList.innerHTML = "";
    const matches = mockDatabase.filter(user => user.name.includes(searchName));
    if (matches.length === 0) { document.getElementById('searchMsg').innerText = "找不到暱稱"; document.getElementById('searchResults').style.display = 'none'; } 
    else {
        document.getElementById('searchResults').style.display = 'block';
        matches.forEach(user => {
            const item = document.createElement('div'); item.className = 'search-result-item'; item.innerHTML = `<span>${user.name}</span><span style="color:#666;">ID: ${user.id}</span>`;
            item.addEventListener('click', () => { gameState.currentUser = { id: user.id, name: user.name }; updateUserDisplays(); showSection('gameSelectionBox'); });
            resultList.appendChild(item);
        });
    }
});
function updateUserDisplays() {
    document.querySelectorAll('.displayPlayerName').forEach(el => el.innerText = gameState.currentUser.name);
    document.querySelectorAll('.displayPlayerId').forEach(el => el.innerText = gameState.currentUser.id);
}
document.getElementById('logoutBtnFromSelect').addEventListener('click', () => location.reload());

window.goToSettings = function(type) {
    gameState.gameType = type;
    const titleMap = { 'pincer': '🤏捏手指!', 'palmar': '👊握拳!!', 'numbers': '✌️比數字' };
    document.getElementById('settingGameTitle').innerText = titleMap[type];
    document.getElementById('pincerSettings').style.display = (type === 'pincer') ? 'block' : 'none';
    showSection('gameSettingsBox');
};

// ==========================================
// 3. 遊戲前說明與預覽邏輯 
// ==========================================
document.getElementById('preGameInstructionBtn').addEventListener('click', () => {
    gameState.handUsed = document.getElementById('handUsed').value;
    gameState.difficulty = document.getElementById('pincerDifficulty').value;
    
    document.getElementById('instructionGameTitle').innerText = document.getElementById('settingGameTitle').innerText;
    
    const pincerHard = document.getElementById('pincerDifficultGuide');
    const pincerEasy = document.getElementById('pincerEasyGuide');
    const palmar = document.getElementById('palmarGuide');
    const numbers = document.getElementById('numbersGuide');
    
    [pincerHard, pincerEasy, palmar, numbers].forEach(el => el.style.display = 'none');

    if (gameState.gameType === 'palmar') {
        palmar.style.display = 'block';
    } else if (gameState.gameType === 'numbers') {
        numbers.style.display = 'block';
    } else if (gameState.gameType === 'pincer') {
        if (gameState.difficulty === 'hard') {
            pincerHard.style.display = 'block';
            const leftBox = document.querySelector('.mock-left-box');
            const rightBox = document.querySelector('.mock-right-box');
            if (gameState.handUsed === 'right') { leftBox.style.visibility = 'hidden'; rightBox.style.visibility = 'visible'; } 
            else if (gameState.handUsed === 'left') { leftBox.style.visibility = 'visible'; rightBox.style.visibility = 'hidden'; } 
            else { leftBox.style.visibility = 'visible'; rightBox.style.visibility = 'visible'; }
        } else pincerEasy.style.display = 'block';
    }
    showSection('pincerPreviewBox');
});

// 🌟 倒數計時器動畫函式 🌟
function startCountdown(onComplete) {
    const overlay = document.getElementById('countdownOverlay');
    const countdownText = document.getElementById('countdownText');
    
    let count = 3;
    countdownText.innerText = count;
    countdownText.style.color = "#007bff";
    countdownText.style.animation = 'none';
    countdownText.offsetHeight; 
    countdownText.style.animation = 'popIn 0.3s ease-out';

    let timer = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.innerText = count;
            countdownText.style.animation = 'none';
            countdownText.offsetHeight; 
            countdownText.style.animation = 'popIn 0.3s ease-out';
        } else if (count === 0) {
            countdownText.innerText = "Start!";
            countdownText.style.color = "#28a745"; 
            countdownText.style.animation = 'none';
            countdownText.offsetHeight;
            countdownText.style.animation = 'popIn 0.3s ease-out';
        } else {
            clearInterval(timer);
            overlay.style.display = 'none';
            if(onComplete) onComplete();
        }
    }, 1000);
}

// 🌟 遊戲核心 🌟
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults((results) => {
    try {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
                drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});
            }
        }
        
        // 🌟 修正：畫完骨架後，如果還沒倒數完，就阻斷後面的遊戲判定邏輯
        if (!gameState.isPlaying) return; 
        
        let currentHands = (results.multiHandLandmarks) ? results.multiHandLandmarks : [];
        let currentHandedness = (results.multiHandedness) ? results.multiHandedness : [];
        
        if (gameState.gameType === 'palmar') { drawPalmarGame(canvasCtx); checkPalmarLogic(currentHands, currentHandedness); } 
        else if (gameState.gameType === 'pincer') { drawPincerGame(canvasCtx); checkPincerLogic(currentHands, currentHandedness); }
        else if (gameState.gameType === 'numbers') { drawNumbersGame(canvasCtx); checkNumbersLogic(currentHands, currentHandedness); }
    } catch (error) {}
});

document.getElementById('finalConfirmStartBtn').addEventListener('click', () => {
    const levelCount = parseInt(document.getElementById('levelCount').value);
    const timeLimit = parseInt(document.getElementById('timeLimit').value); 

    // 初始化 UI 資訊
    const handMap = { 'right': '右手', 'left': '左手', 'both': '雙手' };
    document.getElementById('hudPlayer').innerText = `玩家：${gameState.currentUser.name}`;
    document.getElementById('hudType').innerText = `項目：${document.getElementById('settingGameTitle').innerText}`;
    document.getElementById('hudHand').innerText = `使用手：${handMap[gameState.handUsed]}`;
    document.getElementById('hudLevel').innerText = `關卡：1 / ${levelCount}`;
    
    if (gameState.gameType === 'pincer') {
        document.getElementById('hudDifficulty').innerText = `難度：${gameState.difficulty==='hard'?'困難版':'簡單版'}`;
        document.getElementById('hudDifficulty').style.display = 'block';
    } else document.getElementById('hudDifficulty').style.display = 'none';

    document.getElementById('hudPrompt').style.display = (gameState.gameType === 'numbers') ? 'block' : 'none';

    showSection('gameArea'); 
    
    // 🌟 設定為「非遊玩狀態」並開啟倒數遮罩
    gameState.isPlaying = false;
    const overlay = document.getElementById('countdownOverlay');
    const countdownText = document.getElementById('countdownText');
    overlay.style.display = 'flex';
    countdownText.innerText = "相機啟動中...";
    countdownText.style.color = "#6c757d";

    // 🌟 修正：移除了重複宣告的 let settings 變數
    let settings = { maxLevels: levelCount, handUsed: gameState.handUsed, timeLimit: timeLimit, difficulty: gameState.difficulty };
    let cameraStarted = false; 
    let warmUpFrames = 0; // 🌟 新增：紀錄 AI 暖身的影格數

    window.gameCamera = new Camera(webcam, {
        onFrame: async () => {
            if (webcam.videoWidth > 0 && canvasElement.width !== webcam.videoWidth) {
                canvasElement.width = webcam.videoWidth; canvasElement.height = webcam.videoHeight;
            }
            
            try { 
                // 先讓 AI 進行運算
                await hands.send({image: webcam}); 
                
                // 🌟 核心修正：等 AI 成功辨識 3 張畫面（確定暖身完畢、沒有卡頓）後，才開始倒數 321
                if (!cameraStarted) {
                    warmUpFrames++;
                    if (warmUpFrames >= 3) {
                        cameraStarted = true;
                        startCountdown(() => {
                            // 倒數結束，正式初始化遊戲物件並把 isPlaying 設為 true！
                            if (gameState.gameType === 'palmar') initPalmarGame(settings, canvasElement.width, canvasElement.height);
                            if (gameState.gameType === 'pincer') initPincerGame(settings, canvasElement.width, canvasElement.height);
                            if (gameState.gameType === 'numbers') initNumbersGame(settings, canvasElement.width, canvasElement.height);
                            gameState.isPlaying = true;
                        });
                    }
                }
            } catch (e) {}
        }, width: 1280, height: 720
    });
    window.gameCamera.start();
});

// ==========================================
// 5. 報告與儲存
// ==========================================
window.saveGameRecord = function(records) {
    gameState.isPlaying = false; 
    document.getElementById('hudPrompt').style.display = 'none'; 
    if (window.gameCamera) window.gameCamera.stop();
    const video = document.getElementById('webcam');
    if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
    
    let totalSecs = 0;
    records.details.filter(d => d.status === 'success').forEach(d => totalSecs += parseFloat(d.time));
    let avgTime = records.success > 0 ? (totalSecs / records.success).toFixed(2) : "0.00";

    const handMap = { 'right': '右手', 'left': '左手', 'both': '雙手' };
    let reportHTML = `
        <p><strong>遊戲項目：</strong> ${document.getElementById('settingGameTitle').innerText}</p>
        <p><strong>玩法：</strong> ${handMap[gameState.handUsed]} ${gameState.gameType === 'pincer' ? (gameState.difficulty==='hard'?'(困難)':'(簡單)') : ''}</p>
        <p><strong>完成關卡：</strong> <span style="color: green;">${records.success} 關成功</span> / <span style="color: red;">${records.fail} 關失敗</span></p>
        <p><strong>成功關卡平均時間：</strong> ${avgTime} 秒</p>
    `;
    document.getElementById('reportDataContent').innerHTML = reportHTML;
    
    gameState.currentReport = records; 
    document.getElementById('finalPlayerName').value = gameState.currentUser.name;
    document.getElementById('finalPlayerId').value = gameState.currentUser.id; 
    showSection('endReportBox');
};
document.getElementById('saveDataBtn').addEventListener('click', () => { 
    const feedbackText = document.getElementById('playerFeedback').value;
    alert(`資料儲存成功！`); 
    document.getElementById('playerFeedback').value = ''; 
    showSection('gameSelectionBox'); 
});
document.getElementById('endGameBtn').addEventListener('click', () => { if(confirm("確定要提早結束測驗嗎？")) window.saveGameRecord({ success: 0, fail: 0, details: [] }); });