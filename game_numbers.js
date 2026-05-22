// ==========================================
// game_numbers.js - Number Matching (比數字)
// ==========================================

let numState = {
    currentLevel: 1, maxLevels: 10, 
    handUsed: 'right', 
    targetLeft: 0, targetRight: 0, // 目標數字 0-5
    
    timeLimit: 10, levelStartTime: 0, isGameOver: false,
    levelTransitioning: false, 
    records: { success: 0, fail: 0, details: [] } 
};

let htmlAlertRelax = null;
let htmlAlertWrongHand = null;
let htmlPromptBox = null;

function getRawDist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// 🌟 核心：判定舉起了幾根手指 🌟
function countFingers(landmarks) {
    let count = 0;
    const wrist = landmarks[0];
    
    // 食指, 中指, 無名指, 小指 (判斷指尖是否比第二指節離手腕更遠)
    const fingers = [ { tip: 8, pip: 6 }, { tip: 12, pip: 10 }, { tip: 16, pip: 14 }, { tip: 20, pip: 18 } ];
    for (const f of fingers) {
        if (getRawDist(wrist, landmarks[f.tip]) > getRawDist(wrist, landmarks[f.pip])) count++;
    }
    
    // 大拇指 (判斷指尖是否比第二關節離小指根部更遠)
    const thumbTip = landmarks[4];
    const thumbIp = landmarks[3];
    const pinkyBase = landmarks[17];
    if (getRawDist(thumbTip, pinkyBase) > getRawDist(thumbIp, pinkyBase)) count++;
    
    return count;
}

function spawnTargets() {
    // 隨機產生 0 到 5 的數字
    numState.targetLeft = Math.floor(Math.random() * 6);
    numState.targetRight = Math.floor(Math.random() * 6);
    
    // 更新 HTML 頂部題目框
    if (htmlPromptBox) {
        if (numState.handUsed === 'both') {
            htmlPromptBox.innerText = `🎯 左手：${numState.targetLeft} ｜ 右手：${numState.targetRight}`;
        } else {
            let target = numState.handUsed === 'left' ? numState.targetLeft : numState.targetRight;
            htmlPromptBox.innerText = `🎯 請比出數字：${target}`;
        }
        // 重置樣式 (藍色)
        htmlPromptBox.style.backgroundColor = "rgba(0, 86, 179, 0.9)";
        htmlPromptBox.style.borderColor = "#ffffff";
    }
}

function handleLevelComplete(isSuccess) {
    numState.levelTransitioning = true; 
    let timeTaken = ((Date.now() - numState.levelStartTime) / 1000).toFixed(2);
    
    if (isSuccess) {
        numState.records.success++;
        numState.records.details.push({ level: numState.currentLevel, status: 'success', time: timeTaken });
        if (htmlAlertRelax) { 
            htmlAlertRelax.innerText = "🎉 辨識成功！"; 
            htmlAlertRelax.style.color = "#155724"; htmlAlertRelax.style.backgroundColor = "#d4edda"; htmlAlertRelax.style.borderColor = "#c3e6cb"; 
            htmlAlertRelax.style.display = 'block'; 
        }
        // 題目框變綠色
        if (htmlPromptBox) { htmlPromptBox.style.backgroundColor = "rgba(40, 167, 69, 0.9)"; htmlPromptBox.style.borderColor = "#c3e6cb"; }
    } else {
        numState.records.fail++;
        numState.records.details.push({ level: numState.currentLevel, status: 'fail', time: 'timeout' });
        if (htmlAlertRelax) { 
            htmlAlertRelax.innerText = "💥 失敗！超時未完成"; 
            htmlAlertRelax.style.color = "#721c24"; htmlAlertRelax.style.backgroundColor = "#f8d7da"; htmlAlertRelax.style.borderColor = "#f5c6cb"; 
            htmlAlertRelax.style.display = 'block'; 
        }
        // 題目框變紅色
        if (htmlPromptBox) { htmlPromptBox.style.backgroundColor = "rgba(220, 53, 69, 0.9)"; htmlPromptBox.style.borderColor = "#f5c6cb"; }
    }

    setTimeout(() => {
        numState.currentLevel++;
        numState.levelTransitioning = false; 
        if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';

        if (numState.currentLevel > numState.maxLevels) {
            numState.isGameOver = true; 
            if (typeof window.saveGameRecord === 'function') window.saveGameRecord(numState.records);
        } else {
            document.getElementById('hudLevel').innerText = `關卡：${numState.currentLevel} / ${numState.maxLevels}`;
            spawnTargets();
            numState.levelStartTime = Date.now(); // 進入下一關立刻計時
        }
    }, 1200); 
}

export function initNumbersGame(settings, canvasWidth, canvasHeight) {
    numState.maxLevels = settings.maxLevels;
    numState.handUsed = settings.handUsed;
    numState.timeLimit = settings.timeLimit || 10; 
    numState.currentLevel = 1;
    numState.isGameOver = false; 
    numState.levelTransitioning = false;
    numState.records = { success: 0, fail: 0, details: [] };
    window.currentGameRecords = pincerState.records; // 🌟 暴露當前紀錄給全域
    
    htmlAlertRelax = document.getElementById('alertRelax');
    htmlAlertWrongHand = document.getElementById('alertWrongHand');
    htmlPromptBox = document.getElementById('hudPrompt');
    
    if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';
    if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';

    spawnTargets();
    numState.levelStartTime = Date.now(); 
}

export function drawNumbersGame(canvasCtx) {
    let remaining = 0;
    
    if (numState.levelStartTime > 0 && !numState.levelTransitioning && !numState.isGameOver) {
        const elapsed = (Date.now() - numState.levelStartTime) / 1000;
        remaining = Math.max(0, numState.timeLimit - elapsed);
    }

    const timeDisplay = document.getElementById('hudTime');
    if (timeDisplay && !numState.isGameOver) {
        timeDisplay.innerText = `⏳ 剩餘時間：${Math.ceil(remaining).toString().padStart(2, '0')} 秒`;
    }
    
    // 比數字沒有球，所以不用畫東西在 Canvas 上！全靠 HTML 的框框。
}

export function checkNumbersLogic(inputLandmarks, multiHandedness) {
    if (numState.isGameOver || numState.levelTransitioning) return;

    const elapsed = (Date.now() - numState.levelStartTime) / 1000;
    const remaining = numState.timeLimit - elapsed;
    if (remaining <= 0) { handleLevelComplete(false); return; }

    if (!inputLandmarks || inputLandmarks.length === 0) {
        if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
        return;
    }

    let handsData = (inputLandmarks.length === 21 && inputLandmarks[0].x !== undefined) ? [inputLandmarks] : inputLandmarks;
    let cheatingOccurredThisFrame = false;

    let leftHandFingers = -1;
    let rightHandFingers = -1;

    for (let i = 0; i < handsData.length; i++) {
        const landmarks = handsData[i];
        let handLabel = (multiHandedness && multiHandedness[i]) ? (multiHandedness[i].label === 'Left' ? 'Right' : 'Left') : "Unknown";
        
        let fingersRaised = countFingers(landmarks);

        if (numState.handUsed === 'right' && handLabel === 'Left') { cheatingOccurredThisFrame = true; if (htmlAlertWrongHand) { htmlAlertWrongHand.innerText = "❌ 錯誤！請使用右手"; htmlAlertWrongHand.style.display = 'block'; } continue; }
        if (numState.handUsed === 'left' && handLabel === 'Right') { cheatingOccurredThisFrame = true; if (htmlAlertWrongHand) { htmlAlertWrongHand.innerText = "❌ 錯誤！請使用左手"; htmlAlertWrongHand.style.display = 'block'; } continue; }

        if (handLabel === 'Left') leftHandFingers = fingersRaised;
        if (handLabel === 'Right') rightHandFingers = fingersRaised;
    } 

    if (!cheatingOccurredThisFrame && htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
    
    // 🌟 判定通關邏輯 🌟
    let isSuccess = false;
    
    if (numState.handUsed === 'left' && leftHandFingers === numState.targetLeft) isSuccess = true;
    if (numState.handUsed === 'right' && rightHandFingers === numState.targetRight) isSuccess = true;
    if (numState.handUsed === 'both' && leftHandFingers === numState.targetLeft && rightHandFingers === numState.targetRight) isSuccess = true;
    
    if (isSuccess && !cheatingOccurredThisFrame) {
        if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
        handleLevelComplete(true); 
    }
}