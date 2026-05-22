// ==========================================
// game_pincer.js - Pincer Grasp (修正雙手判定與嚴格防作弊版)
// ==========================================

let pincerState = {
    balls: [], currentLevel: 1, maxLevels: 10, 
    handUsed: 'right', difficulty: 'easy', 
    canvasWidth: 1280, canvasHeight: 720, debugDotsArray: [],
    
    timeLimit: 10, levelStartTime: 0, isGameOver: false,
    levelTransitioning: false, 
    needsRelease: true, 
    
    records: { success: 0, fail: 0, details: [] } 
};

let htmlAlertRelax = null;
let htmlAlertWrongHand = null;

function getPixelDist(p1, p2, w, h) {
    let x1 = p1.x * w, y1 = p1.y * h;
    let x2 = p2.x * w, y2 = p2.y * h;
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

// ==========================================
// 修正版：動作解耦與彈性門檻演算法
// ==========================================

// 1. 讓新關卡開始前的「放鬆準備」更流暢
function isFingerOpen(landmarks, targetFinger, w, h) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    const middle = landmarks[12];
    
    const handSize = getPixelDist(landmarks[0], landmarks[5], w, h);
    // 🌟 將放鬆門檻調整為合理的 0.45，只要手指離開捏合狀態就算放開
    const releaseThreshold = handSize * 0.45; 

    const distIndex = getPixelDist(thumb, index, w, h);
    const distMiddle = getPixelDist(thumb, middle, w, h);

    if (pincerState.difficulty === 'easy' || targetFinger === 'any') {
        return (distIndex > releaseThreshold && distMiddle > releaseThreshold);
    } else if (pincerState.difficulty === 'hard') {
        if (targetFinger === 'index') return distIndex > releaseThreshold;
        if (targetFinger === 'middle') return distMiddle > releaseThreshold;
    }
    return true;
}

// 2. 嚴格防作弊，但釋放生理連動性的捏合判定
function isHandPinching(landmarks, targetFinger, w, h) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    const middle = landmarks[12];
    
    const handSize = getPixelDist(landmarks[0], landmarks[5], w, h);
    // 🌟 稍微放寬捏合門檻至 0.38，提高視覺追蹤的容錯率
    const pinchThreshold = handSize * 0.38; 

    const distIndex = getPixelDist(thumb, index, w, h);
    const distMiddle = getPixelDist(thumb, middle, w, h);

    if (pincerState.difficulty === 'easy' || targetFinger === 'any') {
        return (distIndex < pinchThreshold || distMiddle < pinchThreshold);
    } else if (pincerState.difficulty === 'hard') {
        // 🌟 核心修正：捨棄絕對數值，改用「相對倍數判定」 🌟
        if (targetFinger === 'index') {
            // 食指貼近拇指，且中指與拇指的距離必須是食指的 1.7 倍以上 (代表中指放鬆、沒一起捏)
            return (distIndex < pinchThreshold) && (distMiddle > distIndex * 1.7);
        }
        if (targetFinger === 'middle') {
            // 中指貼近拇指，且食指與拇指的距離必須是中指的 1.7 倍以上
            return (distMiddle < pinchThreshold) && (distIndex > distMiddle * 1.7);
        }
    }
    return false;
}

function spawnBalls() {
    // 🌟 核心修改：大幅增加邊界安全距離 🌟
    const marginX = 150; // 左右往內縮 150 px
    const marginY = 120; // 上下往內縮 120 px
    const ballRadius = 40; 
    const halfW = pincerState.canvasWidth / 2;
    const h = pincerState.canvasHeight;
    const w = pincerState.canvasWidth;
    
    let newBalls = [];

    function getNextPos(oldBall, minX, maxX) {
        // 第一顆球不再死板地出現在 Y軸中間，而是在安全範圍內隨機出現
        if (!oldBall) return { 
            x: Math.floor(Math.random() * (maxX - minX - marginX * 2)) + minX + marginX, 
            y: Math.floor(Math.random() * (h - marginY * 2)) + marginY 
        };
        
        let valid = false; let newX, newY;
        let attempts = 0;
        
        while (!valid && attempts < 50) {
            let angle = Math.random() * Math.PI * 2;
            let distance = 150 + Math.random() * 200; 
            newX = oldBall.x + Math.cos(angle) * distance;
            newY = oldBall.y + Math.sin(angle) * distance;
            
            // 嚴格限制新球必須在擴大後的安全範圍內
            if (newX >= minX + marginX && newX <= maxX - marginX && 
                newY >= marginY && newY <= h - marginY) {
                valid = true;
            }
            attempts++;
        }
        
        // 如果隨機 50 次都找不到好位置，強制重置在安全範圍內的隨機點 (防呆機制)
        if(!valid) return { 
            x: Math.floor(Math.random() * (maxX - minX - marginX * 2)) + minX + marginX, 
            y: Math.floor(Math.random() * (h - marginY * 2)) + marginY 
        }; 
        
        return { x: newX, y: newY };
    }

    const fingers = ['index', 'middle'];
    let nextTarget = 'any';
    if (pincerState.difficulty === 'hard') nextTarget = fingers[Math.floor(Math.random() * fingers.length)];

    let defaultProps = { radius: ballRadius, color: '#FFD700', isTouched: false, isGrasped: false, isFailed: false, targetFinger: nextTarget };

    if (pincerState.handUsed === 'left' || pincerState.handUsed === 'right') {
        let oldBall = pincerState.balls[0] || null;
        let pos = getNextPos(oldBall, 0, w);
        newBalls.push({ ...defaultProps, x: pos.x, y: pos.y });
    } else if (pincerState.handUsed === 'both') {
        let nextTargetL = pincerState.difficulty === 'hard' ? fingers[Math.floor(Math.random() * fingers.length)] : 'any';
        let oldL = pincerState.balls.find(b => b.side === 'left') || null;
        let posL = getNextPos(oldL, 0, halfW);
        newBalls.push({ ...defaultProps, x: posL.x, y: posL.y, side: 'left', targetFinger: nextTargetL });

        let nextTargetR = pincerState.difficulty === 'hard' ? fingers[Math.floor(Math.random() * fingers.length)] : 'any';
        let oldR = pincerState.balls.find(b => b.side === 'right') || null;
        let posR = getNextPos(oldR, halfW, w);
        newBalls.push({ ...defaultProps, x: posR.x, y: posR.y, side: 'right', targetFinger: nextTargetR });
    }
    pincerState.balls = newBalls;
}

function handleLevelComplete(isSuccess) {
    pincerState.levelTransitioning = true; 
    let timeTaken = ((Date.now() - pincerState.levelStartTime) / 1000).toFixed(2);
    
    if (isSuccess) {
        pincerState.records.success++;
        pincerState.records.details.push({ level: pincerState.currentLevel, status: 'success', time: timeTaken });
        if (htmlAlertRelax) { 
            htmlAlertRelax.innerText = "🎉 捏合成功！"; 
            htmlAlertRelax.style.color = "#155724"; 
            htmlAlertRelax.style.backgroundColor = "#d4edda"; 
            htmlAlertRelax.style.borderColor = "#c3e6cb"; 
            htmlAlertRelax.style.display = 'block'; 
        }
    } else {
        pincerState.records.fail++;
        pincerState.records.details.push({ level: pincerState.currentLevel, status: 'fail', time: 'timeout' });
        pincerState.balls.forEach(b => b.isFailed = true); 
        if (htmlAlertRelax) { 
            htmlAlertRelax.innerText = "💥 失敗！超時未完成"; 
            htmlAlertRelax.style.color = "#721c24"; 
            htmlAlertRelax.style.backgroundColor = "#f8d7da"; 
            htmlAlertRelax.style.borderColor = "#f5c6cb"; 
            htmlAlertRelax.style.display = 'block'; 
        }
    }

    setTimeout(() => {
        pincerState.currentLevel++;
        pincerState.levelTransitioning = false; 
        if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';

        if (pincerState.currentLevel > pincerState.maxLevels) {
            pincerState.isGameOver = true; 
            if (typeof window.saveGameRecord === 'function') window.saveGameRecord(pincerState.records);
        } else {
            document.getElementById('hudLevel').innerText = `關卡：${pincerState.currentLevel} / ${pincerState.maxLevels}`;
            spawnBalls();
            pincerState.levelStartTime = Date.now(); 
            pincerState.needsRelease = true; 
        }
    }, 1200); 
}

export function initPincerGame(settings, canvasWidth, canvasHeight) {
    pincerState.maxLevels = settings.maxLevels;
    pincerState.handUsed = settings.handUsed;
    pincerState.difficulty = settings.difficulty;
    pincerState.timeLimit = settings.timeLimit || 10; 
    pincerState.canvasWidth = canvasWidth;
    pincerState.canvasHeight = canvasHeight;
    pincerState.currentLevel = 1;
    pincerState.isGameOver = false; 
    pincerState.levelTransitioning = false;
    pincerState.needsRelease = true; 
    pincerState.records = { success: 0, fail: 0, details: [] };
    window.currentGameRecords = pincerState.records; // 🌟 暴露當前紀錄給全域
    pincerState.balls = []; 
    
    htmlAlertRelax = document.getElementById('alertRelax');
    htmlAlertWrongHand = document.getElementById('alertWrongHand');
    if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';
    if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';

    spawnBalls();
    pincerState.levelStartTime = Date.now(); 
}

export function drawPincerGame(canvasCtx) {
    let remaining = 0;
    
    if (pincerState.levelStartTime > 0 && !pincerState.levelTransitioning && !pincerState.isGameOver) {
        const elapsed = (Date.now() - pincerState.levelStartTime) / 1000;
        remaining = Math.max(0, pincerState.timeLimit - elapsed);
    }

    const timeDisplay = document.getElementById('hudTime');
    if (timeDisplay && !pincerState.isGameOver) {
        timeDisplay.innerText = `⏳ 剩餘時間：${Math.ceil(remaining).toString().padStart(2, '0')} 秒`;
    }

    if (pincerState.difficulty === 'hard' && !pincerState.levelTransitioning) {
        canvasCtx.save();
        canvasCtx.scale(-1, 1);
        
        for (const ball of pincerState.balls) {
            let fingerName = ball.targetFinger === 'index' ? "食指" : "中指";
            let textStr = `指定: ${fingerName}`;
            
            let isLeftSide = true;
            if (pincerState.handUsed === 'left') {
                isLeftSide = true; 
            } else if (pincerState.handUsed === 'right') {
                isLeftSide = false; 
            } else if (pincerState.handUsed === 'both') {
                isLeftSide = (ball.side === 'left'); 
            }
            
            let textX = isLeftSide ? -pincerState.canvasWidth + 20 : -200; 
            let textY = 60; 
            
            canvasCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
            canvasCtx.fillRect(textX - 10, textY - 35, 180, 50);
            canvasCtx.font = "bold 32px sans-serif";
            canvasCtx.fillStyle = "#FFFFFF";
            canvasCtx.textAlign = "left";
            canvasCtx.fillText(textStr, textX, textY);
        }
        canvasCtx.restore();
    }

    for (const ball of pincerState.balls) {
        canvasCtx.beginPath(); canvasCtx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
        if (ball.isFailed) { canvasCtx.fillStyle = '#dc3545'; canvasCtx.strokeStyle = '#8b0000'; } 
        else if (ball.isGrasped) { canvasCtx.fillStyle = '#28a745'; canvasCtx.strokeStyle = '#1e7e34'; } 
        else { canvasCtx.fillStyle = '#FFD700'; canvasCtx.strokeStyle = ball.isTouched ? '#dc3545' : '#B8860B'; }
        canvasCtx.fill(); canvasCtx.lineWidth = (ball.isTouched || ball.isFailed) ? 8 : 4; canvasCtx.stroke();

        if (!ball.isFailed && !ball.isGrasped && !pincerState.levelTransitioning && remaining <= 4 && remaining > 0) {
            canvasCtx.save();
            canvasCtx.fillStyle = '#dc3545'; canvasCtx.font = "bold 40px sans-serif"; canvasCtx.textAlign = "center"; canvasCtx.textBaseline = "middle";
            canvasCtx.translate(ball.x, ball.y); canvasCtx.scale(-1, 1);
            canvasCtx.fillText(Math.ceil(remaining).toString(), 0, 0);
            canvasCtx.restore();
        }
    }
    
    if (pincerState.debugDotsArray && pincerState.debugDotsArray.length > 0) {
        for (const dot of pincerState.debugDotsArray) {
            canvasCtx.beginPath(); canvasCtx.arc(dot.x, dot.y, 6, 0, 2 * Math.PI); 
            canvasCtx.fillStyle = dot.color; canvasCtx.fill(); canvasCtx.strokeStyle = '#FFF'; canvasCtx.lineWidth = 1; canvasCtx.stroke();
        }
    }
}

export function checkPincerLogic(inputLandmarks, multiHandedness) {
    if (pincerState.isGameOver || pincerState.levelTransitioning) return;

    const elapsed = (Date.now() - pincerState.levelStartTime) / 1000;
    const remaining = pincerState.timeLimit - elapsed;
    if (remaining <= 0) { handleLevelComplete(false); return; }

    if (!inputLandmarks || inputLandmarks.length === 0) {
        pincerState.debugDotsArray = [];
        if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
        return;
    }

    let handsData = (inputLandmarks.length === 21 && inputLandmarks[0].x !== undefined) ? [inputLandmarks] : inputLandmarks;

    if (pincerState.needsRelease) {
        let allHandsReady = true;
        let validHandFound = false;

        for (let i = 0; i < handsData.length; i++) {
            const landmarks = handsData[i];
            if (!landmarks[8]) continue;
            validHandFound = true;

            let handLabel = (multiHandedness && multiHandedness[i]) ? (multiHandedness[i].label === 'Left' ? 'Right' : 'Left') : "Unknown";
            
            let targetFinger = 'any';
            for (const ball of pincerState.balls) {
                if (pincerState.handUsed === 'both') {
                    if (ball.x < pincerState.canvasWidth / 2 && handLabel === 'Right') targetFinger = ball.targetFinger;
                    if (ball.x >= pincerState.canvasWidth / 2 && handLabel === 'Left') targetFinger = ball.targetFinger;
                } else {
                    targetFinger = ball.targetFinger;
                }
            }

            if (!isFingerOpen(landmarks, targetFinger, pincerState.canvasWidth, pincerState.canvasHeight)) {
                allHandsReady = false;
            }
        }

        if (allHandsReady && validHandFound) {
            pincerState.needsRelease = false;
            if (htmlAlertRelax) htmlAlertRelax.style.display = 'none';
        } else {
            if (htmlAlertRelax) {
                htmlAlertRelax.innerText = "👋 請先張開手指放鬆！";
                htmlAlertRelax.style.color = "#856404";
                htmlAlertRelax.style.backgroundColor = "#fff3cd";
                htmlAlertRelax.style.borderColor = "#ffeeba";
                htmlAlertRelax.style.display = 'block';
            }
            // 在放鬆階段，強制重置球的狀態
            pincerState.balls.forEach(ball => { ball.isTouched = false; ball.isGrasped = false; });
            pincerState.debugDotsArray = [];
            return; 
        }
    }

    // 🌟 修正 Bug 3：遊戲正常進行中，不清除 ball.isGrasped，讓雙手捏合狀態可以「保留 (Sticky)」
    pincerState.balls.forEach(ball => { ball.isTouched = false; }); 
    pincerState.debugDotsArray = [];
    let cheatingOccurredThisFrame = false;

    for (let i = 0; i < handsData.length; i++) {
        const landmarks = handsData[i];
        if (!landmarks[8]) continue; 

        let handLabel = (multiHandedness && multiHandedness[i]) ? (multiHandedness[i].label === 'Left' ? 'Right' : 'Left') : "Unknown";
        let dotColor = (handLabel === 'Right') ? '#FF69B4' : '#00BFFF';
        
        const interactionX = landmarks[4].x * pincerState.canvasWidth;
        const interactionY = landmarks[4].y * pincerState.canvasHeight;
        pincerState.debugDotsArray.push({ x: interactionX, y: interactionY, color: dotColor });
        
        if (pincerState.handUsed === 'right' && handLabel === 'Left') { cheatingOccurredThisFrame = true; if (htmlAlertWrongHand) { htmlAlertWrongHand.innerText = "❌ 錯誤！請使用右手"; htmlAlertWrongHand.style.display = 'block'; } continue; }
        if (pincerState.handUsed === 'left' && handLabel === 'Right') { cheatingOccurredThisFrame = true; if (htmlAlertWrongHand) { htmlAlertWrongHand.innerText = "❌ 錯誤！請使用左手"; htmlAlertWrongHand.style.display = 'block'; } continue; }

        for (const ball of pincerState.balls) {
            if (pincerState.handUsed === 'both') {
                if (ball.x < pincerState.canvasWidth / 2 && handLabel !== 'Right') continue;
                if (ball.x >= pincerState.canvasWidth / 2 && handLabel !== 'Left') continue;
            }
            
            const distToBall = Math.sqrt(Math.pow(interactionX - ball.x, 2) + Math.pow(interactionY - ball.y, 2));
            if (distToBall < ball.radius) {
                ball.isTouched = true; 
                if (isHandPinching(landmarks, ball.targetFinger, pincerState.canvasWidth, pincerState.canvasHeight)) {
                    ball.isGrasped = true; // 🌟 捏到後就會一直保持 true，直到下一關
                }
            }
        }
    } 

    if (!cheatingOccurredThisFrame && htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
    
    if (pincerState.balls.every(ball => ball.isGrasped === true) && pincerState.balls.length > 0) {
        if (htmlAlertWrongHand) htmlAlertWrongHand.style.display = 'none';
        handleLevelComplete(true); 
    }
}