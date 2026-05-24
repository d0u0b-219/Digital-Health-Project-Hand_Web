// ==========================================
// 1. 模組引入、全域狀態與 Firebase 初始化
// ==========================================
import { initPalmarGame, drawPalmarGame, checkPalmarLogic } from './game_palmar.js';
import { initPincerGame, drawPincerGame, checkPincerLogic } from './game_pincer.js';
import { initNumbersGame, drawNumbersGame, checkNumbersLogic } from './game_numbers.js';

// 🔥 加入 Firebase 模組
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// 💡 更新：引入 Google 登入需要的工具
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// 🔥 你的 Firebase 設定 (請替換成你主控台上的真實金鑰)
const firebaseConfig = {
  apiKey: "AIzaSyBOgugClwyODc9OFL_fQSNA5eYCb3H3sc8",
  authDomain: "digital-health-project-hand.firebaseapp.com",
  projectId: "digital-health-project-hand",
  storageBucket: "digital-health-project-hand.firebasestorage.app",
  messagingSenderId: "22203538668",
  appId: "1:22203538668:web:847a5e212fa9678d0959c9"
};

// 初始化 Firebase 與 Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "hand-game-db");
const auth = getAuth(app);
// 💡 建立一個 Google 登入的提供者
const provider = new GoogleAuthProvider();

// 抓取 DOM 元素
const loginBtn = document.getElementById('btn-login');

let currentUserId = null;
let gameState = { 
    isPlaying: false, gameType: 'palmar', handUsed: 'right', difficulty: 'easy', 
    currentReport: null, currentUser: { id: '', name: '' } 
};

const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const webcam = document.getElementById('webcam');

window.showSection = function(sectionId) {
    const list = ['welcomeBox', 'registerBox', 'updateProfileBox', 'gameSelectionBox', 'gameSettingsBox', 'pincerPreviewBox', 'gameArea', 'endReportBox', 'playerHistoryBox'];
    list.forEach(id => {
        if(id === 'gameArea') document.getElementById(id).style.display = (id === sectionId) ? 'flex' : 'none';
        else document.getElementById(id).style.display = (id === sectionId) ? 'block' : 'none';
    });
    document.getElementById('mainTitle').style.display = (sectionId === 'gameArea') ? 'none' : 'block';
    
    if (sectionId === 'pincerPreviewBox' || sectionId === 'gameArea') {
        document.body.classList.add('require-landscape');
    } else {
        document.body.classList.remove('require-landscape');
    }
};

// ==========================================
// Google 一鍵登入與狀態檢查
// ==========================================
loginBtn.addEventListener('click', () => {
  signInWithPopup(auth, provider).catch((error) => {
      console.error(error); alert("登入取消或失敗：" + error.message);
  });
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid; 
    
    const userDocRef = doc(db, "users", currentUserId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        gameState.currentUser = { id: data.id, name: data.name };
        updateUserDisplays(); 
        
        // 🌟 攔截檢查：如果有漏填年齡或職業，就導向補填頁面 🌟
        if (!data.age || !data.job) {
            showSection('updateProfileBox');
        } else {
            showSection('gameSelectionBox'); // 老玩家資料齊全，直接進大廳
        }
    } else {
        document.getElementById('regName').value = user.displayName || ''; 
        showSection('registerBox'); 
    }
  } else {
    currentUserId = null;
    gameState.currentUser = { id: '', name: '' };
    showSection('welcomeBox');
  }
});

// ==========================================
// 儲存第一次登入的新玩家資料
// ==========================================
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
    const regName = document.getElementById('regName').value.trim();
    const regId = document.getElementById('regId').value.trim();
    const regAge = document.getElementById('regAge').value;
    const regJob = document.getElementById('regJob').value;
    const regJobNote = document.getElementById('regJobNote').value;
    const msgEl = document.getElementById('regMsg');

    // 🌟 確保所有必填欄位都有填寫 🌟
    if (!regName || !regId || !regAge || !regJob) {
        return msgEl.innerText = "❌ 紅星標示欄位皆為必填！";
    }
    msgEl.innerText = "資料儲存中...";

    try {
        const q = query(collection(db, "users"), where("id", "==", regId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            return msgEl.innerText = "此 ID 已被使用，請換一個！";
        }

        await setDoc(doc(db, "users", currentUserId), {
            id: regId,
            name: regName,
            age: parseInt(regAge),
            job: regJob,
            jobNote: regJobNote,
            email: auth.currentUser.email,
            createdAt: serverTimestamp()
        });

        gameState.currentUser = { id: regId, name: regName };
        updateUserDisplays(); 
        showSection('gameSelectionBox');
        msgEl.innerText = "";
    } catch (e) {
        console.error("Error adding document: ", e);
        msgEl.innerText = "儲存失敗，請檢查網路連線或資料庫權限。";
    }
});


// ==========================================
// 🌟 新增：處理舊玩家資料補齊邏輯 🌟
// ==========================================
document.getElementById('updateProfileBtn').addEventListener('click', async () => {
    const updAge = document.getElementById('updAge').value;
    const updJob = document.getElementById('updJob').value;
    const updJobNote = document.getElementById('updJobNote').value;
    const updMsg = document.getElementById('updMsg');
    
    if (!updAge || !updJob) {
        return updMsg.innerText = "❌ 欄位均為必填！";
    }
    
    document.getElementById('updateProfileBtn').innerText = "雲端同步中...";
    
    try {
        // 使用 merge: true 屬性，只補上缺少的欄位，不覆蓋舊有的 ID 和姓名
        await setDoc(doc(db, "users", currentUserId), {
            age: parseInt(updAge),
            job: updJob,
            jobNote: updJobNote
        }, { merge: true });
        
        alert("🎉 資料補齊成功！已同步至雲端。");
        showSection('gameSelectionBox'); 
    } catch (error) {
        console.error("Error updating user profile: ", error);
        updMsg.innerText = "同步失敗，請檢查連線。";
    } finally {
        document.getElementById('updateProfileBtn').innerText = "儲存並進入遊戲大廳";
    }
});


// ==========================================
// 查看歷史紀錄 (加入平均時間)
// ==========================================
document.getElementById('viewHistoryBtn').addEventListener('click', async () => {
    showSection('playerHistoryBox');
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<p style="text-align: center; color: #999;">資料讀取中...</p>';

    try {
        const q = query(
            collection(db, "game_records"), 
            where("userId", "==", gameState.currentUser.id),
            orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            historyList.innerHTML = '<p style="text-align: center; color: #999;">目前還沒有訓練紀錄喔！趕快開始第一場遊戲吧！</p>';
            return;
        }

        historyList.innerHTML = ''; 
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const dateStr = data.timestamp ? data.timestamp.toDate().toLocaleString('zh-TW') : '未知時間';
            const gameName = { 'palmar': '👊 握拳', 'pincer': '🤏 捏手指', 'numbers': '✌️ 比數字' }[data.gameType];
            
            // 🌟 動態計算成功關卡的平均時間 🌟
            let avgTimeStr = "0.00";
            if (data.details && data.details.length > 0) {
                let totalSecs = 0;
                let validSuccessCount = 0;
                data.details.forEach(d => {
                    if (d.status === 'success') {
                        totalSecs += parseFloat(d.time);
                        validSuccessCount++;
                    }
                });
                if (validSuccessCount > 0) {
                    avgTimeStr = (totalSecs / validSuccessCount).toFixed(2);
                }
            }

            // 🌟 核心修改 3：在歷程清單產生「提早結束」標籤
            const isEarlyExitTag = data.isEarlyExit ? `<span style="background-color: #e9ecef; color: #6c757d; padding: 2px 6px; border-radius: 4px; font-size: 13px; margin-left: 8px; vertical-align: text-bottom;">⚠️ 提早結束</span>` : '';

            // 判斷難易度
            let diffStr = "";
            if (data.gameType === 'pincer' && data.difficulty) {
                diffStr = data.difficulty === 'hard' ? '<span style="color:#dc3545; font-size: 14px; margin-left: 4px;">(困難)</span>' : '<span style="color:#28a745; font-size: 14px; margin-left: 4px;">(簡單)</span>';
            }

            // 🌟 新增：計算設定的關卡與實際玩的關卡 (為了相容舊資料，若無 targetLevels 則以實際玩的關數為主)
            let targetLevels = data.targetLevels || (data.details ? data.details.length : 0);
            let playedLevels = data.details ? data.details.length : 0;

            const item = document.createElement('div');
            item.style.cssText = "background: white; border-left: 5px solid #28a745; padding: 10px; margin-bottom: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";
            
            // 🌟 將「設定 X 關 / 實際完成 Y 關」加入排版中 🌟
            item.innerHTML = `
                <div style="font-size: 14px; color: #666; margin-bottom: 5px;">📅 ${dateStr} ${isEarlyExitTag}</div>
                <div style="font-weight: bold; font-size: 18px; color: #333;"> ${gameName} (${data.handUsed === 'both' ? '雙手' : (data.handUsed === 'left' ? '左手' : '右手')}) ${diffStr}</div>
                <div style="margin-top: 5px; font-size: 14px; color: #555;">
                    ⚙️ 設定 <span style="font-weight: bold;">${targetLevels}</span> 關 ｜ 實際遊玩 <span style="font-weight: bold;">${playedLevels}</span> 關
                </div>
                <div style="margin-top: 5px; font-size: 15px;">
                    ✅ 成功: <span style="color: green; font-weight: bold;">${data.successCount}</span> | 
                    ❌ 失敗: <span style="color: red; font-weight: bold;">${data.failCount}</span> | 
                    <span style="color: #007bff; font-weight: bold;">⏱️ 平均: ${avgTimeStr} 秒</span>
                </div>
            `;
            historyList.appendChild(item);
        });

    } catch (error) {
        console.error("讀取歷史紀錄失敗: ", error);
        historyList.innerHTML = '<p style="text-align: center; color: red;">讀取失敗，請確認網路連線或資料庫索引設定。</p>';
    }
});


// 🌟 判斷玩家裝置類型的輔助函式
function getDeviceType() {
    const ua = navigator.userAgent;
    // 檢查是否為平板
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return "Tablet (平板)";
    }
    // 檢查是否為手機
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return "Mobile (手機)";
    }
    // 預設為電腦/筆電
    return "Desktop/Laptop (電腦)";
}

document.getElementById('saveDataBtn').addEventListener('click', async () => { 
    const feedbackText = document.getElementById('playerFeedback').value;
    const saveBtn = document.getElementById('saveDataBtn');
    
    saveBtn.innerText = "資料上傳中...";
    saveBtn.disabled = true;

    try {
        await addDoc(collection(db, "game_records"), {
            userId: gameState.currentUser.id,
            gameType: gameState.gameType,
            handUsed: gameState.handUsed,
            difficulty: gameState.difficulty,
            timeLimit: parseInt(document.getElementById('timeLimit').value) || 10,
            targetLevels: parseInt(document.getElementById('levelCount').value) || 10, // 🌟 新增這行：記錄一開始設定的關卡數
            successCount: gameState.currentReport ? gameState.currentReport.success : 0,
            failCount: gameState.currentReport ? gameState.currentReport.fail : 0,
            details: gameState.currentReport ? gameState.currentReport.details : [],
            feedback: feedbackText,
            deviceType: getDeviceType(),
            isEarlyExit: gameState.currentReport ? !!gameState.currentReport.isEarlyExit : false,
            timestamp: serverTimestamp()
        });

        alert(`雲端資料儲存成功！`); 
        document.getElementById('playerFeedback').value = ''; 
        showSection('gameSelectionBox'); 
    } catch (e) {
        console.error("Error saving record: ", e);
        alert("儲存失敗，請重試。");
    } finally {
        saveBtn.innerText = "儲存資料並回選單";
        saveBtn.disabled = false;
    }
});

function updateUserDisplays() {
    document.querySelectorAll('.displayPlayerName').forEach(el => el.innerText = gameState.currentUser.name);
    document.querySelectorAll('.displayPlayerId').forEach(el => el.innerText = gameState.currentUser.id);
}

document.getElementById('logoutBtnFromSelect').addEventListener('click', () => {
    signOut(auth).then(() => { alert("已成功登出！"); });
});

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
// 🌟 增加第二個參數 isEarlyExit，預設為 false
window.saveGameRecord = function(records, isEarlyExit = false) {
    gameState.isPlaying = false; 
    document.getElementById('hudPrompt').style.display = 'none'; 
    if (window.gameCamera) window.gameCamera.stop();
    const video = document.getElementById('webcam');
    if (video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }
    
    let totalSecs = 0;
    // 防呆處理，避免提早退出時沒有成績資料報錯
    let successCount = records ? records.success : 0;
    let failCount = records ? records.fail : 0;
    
    if (records && records.details && records.details.length > 0) {
        records.details.filter(d => d.status === 'success').forEach(d => totalSecs += parseFloat(d.time));
    }
    let avgTime = successCount > 0 ? (totalSecs / successCount).toFixed(2) : "0.00";

    const handMap = { 'right': '右手', 'left': '左手', 'both': '雙手' };
    let reportHTML = `
        <p><strong>遊戲項目：</strong> ${document.getElementById('settingGameTitle').innerText}</p>
        <p><strong>玩法：</strong> ${handMap[gameState.handUsed]} ${gameState.gameType === 'pincer' ? (gameState.difficulty==='hard'?'(困難)':'(簡單)') : ''}</p>
        <p><strong>完成關卡：</strong> <span style="color: green;">${successCount} 關成功</span> / <span style="color: red;">${failCount} 關失敗</span></p>
        <p><strong>成功關卡平均時間：</strong> ${avgTime} 秒</p>
    `;
    
    // 🌟 如果是提早退出，就在報告加上低調的灰字備註
    if (isEarlyExit) {
        reportHTML += `<p style="color: #6c757d; font-size: 14px; background: #e9ecef; padding: 6px 10px; border-radius: 5px; display: inline-block; margin-top: 5px; margin-bottom: 0;">ℹ️ 備註：此紀錄為提早結束</p>`;
    }

    document.getElementById('reportDataContent').innerHTML = reportHTML;
    
    // 🌟 核心修改 1：把 isEarlyExit 一併存入暫存狀態中
    gameState.currentReport = records || { success: 0, fail: 0, details: [] }; 
    gameState.currentReport.isEarlyExit = isEarlyExit;

    showSection('endReportBox');
};


document.getElementById('endGameBtn').addEventListener('click', () => { 
    if(confirm("確定要提早結束測驗嗎？")) {
        // 🌟 傳入當下的真實紀錄 window.currentGameRecords，並且標記 isEarlyExit 為 true
        window.saveGameRecord(window.currentGameRecords || { success: 0, fail: 0, details: [] }, true); 
    }
});