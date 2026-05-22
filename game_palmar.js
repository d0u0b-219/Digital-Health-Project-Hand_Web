// ==========================================
// game_palmar.js - Palmar Grasp (文字鏡像修正版)
// ==========================================

let palmarState = {
    balls: [], currentLevel: 1, maxLevels: 10, handUsed: 'right',
    canvasWidth: 1280, canvasHeight: 720, debugDotsArray: [],
    isGameOver: false,
    // 視覺過場鎖定狀態 (保留 1.2 秒讓玩家看清變紅/變綠結果)
    levelTransitioning: false, 
    needsRelease: true, // 🌟 新增這行：記錄是否需要先張開手
    timeLimit: 10, levelStartTime: 0,
    records: { success: 0, fail: 0, details: [] } 
};

let htmlAlertRelax = null;
let htmlAlertWrongHand = null;
let isWaitingForRelax = false;

function getRawDist(p1, p2) { return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)); }
function isHandGrasping(landmarks) {
    const wrist = landmarks[0]; 
    const fingers = [ { tip: 8, pip: 6 }, { tip: 12, pip: 10 }, { tip: 16, pip: 14 }, { tip: 20, pip: 18 } ];
    let curledCount = 0;
    for (const f of fingers) { if (getRawDist(wrist, landmarks[f.tip]) < getRawDist(wrist, landmarks[f.pip])) curledCount++; }
    return curledCount >= 3;
}

// 🌟 新增：判斷是否張開手放鬆
function isHandOpen(landmarks) {
    const wrist = landmarks[0];
    const fingers = [ { tip: 8, pip: 6 }, { tip: 12, pip: 10 }, { tip: 16, pip: 14 }, { tip: 20, pip: 18 } ];
    let extendedCount = 0;
    // 只要有 3 根以上手指的指尖距離手腕大於第二指節，就視為張開
    for (const f of fingers) { if (getRawDist(wrist, landmarks[f.tip]) > getRawDist(wrist, landmarks[f.pip])) extendedCount++; }
    return extendedCount >= 3;
}

function spawnBalls() {
    palmarState.balls = []; 
    const margin = 120; const halfWidth = palmarState.canvasWidth / 2; const ballRadius = 60; 
    
    let defaultBall = { radius: ballRadius, color: '#FFD700', isTouched: false, isGrasped: false, isFailed: false };

    if (palmarState.handUsed === 'left' || palmarState.handUsed === 'right') {
        palmarState.balls.push({ ...defaultBall, 
            x: Math.floor(Math.random() * (palmarState.canvasWidth - margin * 2)) + margin, 
            y: Math.floor(Math.random() * (palmarState.canvasHeight - margin * 2)) + margin 
        });
    } else if (palmarState.handUsed === 'both') {
        palmarState.balls.push({ ...defaultBall, 
            x: Math.floor(Math.random() * (halfWidth - margin * 2)) + margin, 
            y: Math.floor(Math.random() * (palmarState.canvasHeight - margin * 2)) + margin 
        });
        palmarState.balls.push({ ...defaultBall, 
            x: Math.floor(Math.random() * (halfWidth - margin * 2)) + halfWidth + margin, 
            y: Math.floor(Math.random() * (palmarState.canvasHeight - margin * 2)) + margin 
        });
    }
}

// 處理通關或失敗的過場
function handleLevelComplete(isSuccess) {
    palmarState.levelTransitioning = true; // 鎖定判定
    
    let timeTaken = ((Date.now() - palmarState.levelStartTime) / 1000).toFixed(2);
    
    if (isSuccess) {
        palmarState.records.success++;
        palmarState.records.details.push({ level: palmarState.currentLevel, status: 'success', time: timeTaken });
        if (htmlAlertRelax) {
            htmlAlertRelax.innerText = "🎉 成功過關！";
            htmlAlertRelax.style.color = "#155724";
            htmlAlertRelax.style.backgroundColor = "#d4edda";
            htmlAlertRelax.style.borderColor = "#c3e6cb";
            htmlAlertRelax.style.display = 'block';
        }
    } else {
        palmarState.records.fail++;
        palmarState.records.details.push({ level: palmarState.currentLevel, status: 'fail', time: 'timeout' });
        
        palmarState.balls.forEach(b => b.isFailed = true); // 球整顆變紅
        if (htmlAlertRelax) { 
            htmlAlertRelax.innerText = "💥 失敗！超時未完成"; 
            htmlAlertRelax.style.color = "#721c24";
            htmlAlertRelax.style.backgroundColor = "#f8d7da";
            htmlAlertRelax.style.borderColor = "#f5c6cb";
            htmlAlertRelax.style.display = 'block'; 
        }
    }

    // 停留 1.2 秒給予視覺反饋
    setTimeout(() => {
        palmarState.currentLevel++;
        palmarState.levelTransitioning = false; // 解除鎖定
        
        if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';

        if (palmarState.currentLevel > palmarState.maxLevels) {
            palmarState.isGameOver = true; 
            alert(`訓練完成！\n成功：${palmarState.records.success} 關\n失敗：${palmarState.records.fail} 關`);
            if (typeof window.saveGameRecord === 'function') window.saveGameRecord(palmarState.records);
        } else {
            document.getElementById('hudLevel').innerText = `關卡：${palmarState.currentLevel} / ${palmarState.maxLevels}`;
            spawnBalls();
            palmarState.levelStartTime = Date.now(); // 生完球直接進入下一關倒計時，不需等待放開手掌！
            palmarState.needsRelease = true; // 🌟 新增：要求玩家下一關先張開手
        }
    }, 1200); 
}

export function initPalmarGame(settings, canvasWidth, canvasHeight) {
    isWaitingForRelax = false;
    
    palmarState.maxLevels = settings.maxLevels;
    palmarState.handUsed = settings.handUsed;
    palmarState.timeLimit = settings.timeLimit || 10; 
    palmarState.canvasWidth = canvasWidth;
    palmarState.canvasHeight = canvasHeight;
    palmarState.currentLevel = 1;
    palmarState.isGameOver = false; 
    palmarState.levelTransitioning = false;
    palmarState.needsRelease = true;
    palmarState.records = { success: 0, fail: 0, details: [] };
    window.currentGameRecords = palmarState.records; // 🌟 暴露當前紀錄給全域 (提早退出時要抓)
    
    htmlAlertRelax = document.getElementById('alertRelax');
    htmlAlertWrongHand = document.getElementById('alertWrongHand');
    if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';
    if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';

    spawnBalls();
    palmarState.levelStartTime = Date.now(); 
}

export function drawPalmarGame(canvasCtx) {
    let remaining = 0;
    if (palmarState.levelStartTime > 0 && !palmarState.levelTransitioning && !palmarState.isGameOver) {
        const elapsed = (Date.now() - palmarState.levelStartTime) / 1000;
        remaining = Math.max(0, palmarState.timeLimit - elapsed);
    }

    // 更新左上角文字計時器
    const timeDisplay = document.getElementById('hudTime');
    if (timeDisplay && !palmarState.isGameOver) {
        let seconds = Math.ceil(remaining).toString().padStart(2, '0');
        timeDisplay.innerText = `⏳ 剩餘時間：${seconds} 秒`;
    }

    // 畫球與視覺特效
    for (const ball of palmarState.balls) {
        canvasCtx.beginPath();
        canvasCtx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        
        if (ball.isFailed) {
            canvasCtx.fillStyle = '#dc3545'; 
            canvasCtx.strokeStyle = '#8b0000';
        } else if (ball.isGrasped) {
            canvasCtx.fillStyle = '#28a745'; 
            canvasCtx.strokeStyle = '#1e7e34';
        } else {
            canvasCtx.fillStyle = '#FFD700'; 
            canvasCtx.strokeStyle = ball.isTouched ? '#dc3545' : '#B8860B';
        }
        
        canvasCtx.fill();
        canvasCtx.lineWidth = (ball.isTouched || ball.isFailed) ? 8 : 4; 
        canvasCtx.stroke();

        // 🌟 【核心修正】最後 4 秒球心倒數文字鏡像修正 🌟
        if (!ball.isFailed && !ball.isGrasped && !palmarState.levelTransitioning && remaining <= 4 && remaining > 0) {
            canvasCtx.save(); // 保存當前狀態

            // 設定文字樣式
            canvasCtx.fillStyle = '#dc3545'; 
            canvasCtx.font = "bold 60px sans-serif";
            canvasCtx.textAlign = "center";
            canvasCtx.textBaseline = "middle";

            // 🔥 核心反轉魔術：將原點移至球心，並水平反轉坐標系 🔥
            canvasCtx.translate(ball.x, ball.y); // 將坐標系原點移到球的中心
            canvasCtx.scale(-1, 1);               // 水平反轉畫布（scaleX(-1)）
            
            // 此時坐標系已經顛倒，我們在新的坐標系原點 (0,0) 畫字
            canvasCtx.fillText(Math.ceil(remaining).toString(), 0, 0);

            canvasCtx.restore(); // 恢復之前的狀態，不影響其他圖形繪製
        }
    }
    
    // 畫除錯點
    if (palmarState.debugDotsArray && palmarState.debugDotsArray.length > 0) {
        for (const dot of palmarState.debugDotsArray) {
            canvasCtx.beginPath(); canvasCtx.arc(dot.x, dot.y, 10, 0, 2 * Math.PI); 
            canvasCtx.fillStyle = dot.color; canvasCtx.fill();
            canvasCtx.strokeStyle = '#FFFFFF'; canvasCtx.lineWidth = 2; canvasCtx.stroke();
        }
    }
}

export function checkPalmarLogic(inputLandmarks, multiHandedness) {
    if (palmarState.isGameOver || palmarState.levelTransitioning) return;

    // 檢查是否超時(時間到計時一樣繼續走)
    const elapsed = (Date.now() - palmarState.levelStartTime) / 1000;
    const remaining = palmarState.timeLimit - elapsed;
    if (remaining <= 0) {
        handleLevelComplete(false);
        return;
    }

    if (!inputLandmarks || inputLandmarks.length === 0) {
        palmarState.debugDotsArray = [];
        if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
        return;
    }

    let handsData = (inputLandmarks.length === 21 && inputLandmarks[0].x !== undefined) ? [inputLandmarks] : inputLandmarks;

    // 🌟 新增：檢查是否需要放鬆 (張開手)
    if (palmarState.needsRelease) {
        let allHandsReady = true;
        let validHandFound = false;

        for (let i = 0; i < handsData.length; i++) {
            const landmarks = handsData[i];
            if (!landmarks[9]) continue;
            validHandFound = true;
            if (!isHandOpen(landmarks)) allHandsReady = false;
        }

        if (allHandsReady && validHandFound) {
            palmarState.needsRelease = false;
            if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';
        } else {
            if (htmlAlertRelax) {
                htmlAlertRelax.innerText = "👋 請先完全張開手放鬆！";
                htmlAlertRelax.style.color = "#856404";
                htmlAlertRelax.style.backgroundColor = "#fff3cd";
                htmlAlertRelax.style.borderColor = "#ffeeba";
                htmlAlertRelax.style.display = 'block';
            }
            // 阻擋抓球判定
            palmarState.balls.forEach(ball => { ball.isTouched = false; ball.isGrasped = false; });
            palmarState.debugDotsArray = [];
            return; 
        }
    }

    palmarState.balls.forEach(ball => { ball.isTouched = false; ball.isGrasped = false; });
    palmarState.debugDotsArray = [];
    let cheatingOccurredThisFrame = false;

    for (let i = 0; i < handsData.length; i++) {
        const landmarks = handsData[i];
        if (!landmarks[9]) continue;

        let handLabel = (multiHandedness && multiHandedness[i]) ? (multiHandedness[i].label === 'Left' ? 'Right' : 'Left') : "Unknown";
        let dotColor = (handLabel === 'Right') ? '#FF69B4' : '#00BFFF';
        
        const palmX = landmarks[9].x * palmarState.canvasWidth;
        const palmY = landmarks[9].y * palmarState.canvasHeight;
        palmarState.debugDotsArray.push({ x: palmX, y: palmY, color: dotColor });
        
        const grasping = isHandGrasping(landmarks);
        
        if (palmarState.handUsed === 'right' && handLabel === 'Left') {
            if (grasping) { cheatingOccurredThisFrame = true; if (htmlAlertWrongHand) { htmlAlertWrongHand.innerText = "❌ 錯誤！請使用右手"; htmlAlertWrongHand.style.display = 'block'; } }
            continue; 
        }
        if (palmarState.handUsed === 'left' && handLabel === 'Right') {
            if (grasping) { cheatingOccurredThisFrame = true; if (htmlAlertWrongHand) { htmlAlertWrongHand.innerText = "❌ 錯誤！請使用左手"; htmlAlertWrongHand.style.display = 'block'; } }
            continue;
        }

        for (const ball of palmarState.balls) {
            if (palmarState.handUsed === 'both') {
                if (ball.x < palmarState.canvasWidth / 2 && handLabel !== 'Right') continue;
                if (ball.x >= palmarState.canvasWidth / 2 && handLabel !== 'Left') continue;
            }
            if (Math.sqrt(Math.pow(palmX - ball.x, 2) + Math.pow(palmY - ball.y, 2)) < ball.radius) {
                ball.isTouched = true; 
                if (grasping) ball.isGrasped = true; 
            }
        }
    } 

    if (!cheatingOccurredThisFrame && htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
    
    // 成功通關
    if (palmarState.balls.every(ball => ball.isGrasped === true) && palmarState.balls.length > 0) {
        if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
        handleLevelComplete(true); 
    }
}