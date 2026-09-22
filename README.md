# 🖐️ 基於電腦視覺之遊戲化手部功能復健系統
### Gamified Hand Rehabilitation System Based on Computer Vision

> 本專案結合**職能治療臨床評估模型**與**邊緣電腦視覺技術**，開發一套免穿戴裝置、具備低延遲影像回饋的居家手部復健遊戲系統，解決傳統遠距復健缺乏客觀數據追蹤之痛點。

---

## 🔗 線上體驗
* **連結**：[點此試玩](https://d0u0b-219.github.io/Digital-Health-Project-Hand_Web/)


---

## 💡 研究動機與臨床痛點 (Clinical Motivation)
1. **傳統復健局限**：傳統手部動作功能評估（如 Jebsen-Taylor Hand Function Test、Box and Block Test）多依賴治療師肉眼計時與主觀評估，不易居家量測。
2. **穿戴裝置成本高**：傳統感測手套成本高昂且穿戴不易，難以普及於居家連續性訓練。
3. **本系統解方**：利用一般視訊鏡頭（電腦、平板、手機鏡頭）搭配輕量級電腦視覺神經網路，提供即時互動回饋並量化每次動作軌跡與生理反應時間，奠定遠距醫療數據庫基礎。

---

## 🎮 系統核心功能與訓練模式 (Game Modes)

系統涵蓋手部精細與粗大動作控制訓練：

| 訓練項目 | 臨床訓練目標 (OT Focus) | 電腦視覺與演算法實作機制 |
| :--- | :--- | :--- |
| **👊 握拳抓球 (Palmar Grasp)** | 手掌屈曲肌力、手眼協調、抓握與放鬆連續動作控制 | 計算 21 個手部關節點（Landmarks），比對指尖與指節相對手腕之歐幾里得距離，並加入「動作後需完全張開放鬆」之狀態機防弊判定。 |
| **🤏 精細捏取 (Pincer Grasp)** | 拇指-食指/中指對掌能力（Tip Pinch / Pad Pinch） | 採**動態相對倍數演算法**，比對食指與中指之捏合間距倍率，實現「精細動作解耦」，避免指間代償動作。 |
| **✌️ 認知比數字 (Number Matching)** | 認知處理速度、手指獨立控制、個別指節伸展分離度 | 透過空間幾何向量即時辨識 0~5 手指數量，搭配動態限時倒數機制強化認知與肌肉反應協調。 |

---

## 🛠️ 系統架構與技術棧 (System Architecture & Tech Stack)

* **前端介面 (Frontend)**：HTML5, CSS3 (響應式直橫屏適配), JavaScript (ES6+ Modular)
* **視覺演算與手部追蹤 (Computer Vision)**：Google MediaPipe Hands API (即時 21 處 3D 關節座標特徵萃取)
* **後端與雲端資料庫 (Backend & Cloud DB)**：Firebase Realtime Database / Firestore, Firebase Authentication
* **數據分析與圖表 (Data Visualization)**：Chart.js (歷次反應時間趨勢圖、關卡通過率折線圖)

```text
[視訊鏡頭 (Webcam)] 
       │ 
       ▼
[MediaPipe Hands] ── (特徵座標串流 21 Landmarks)
       │
       ▼
[前端幾何/動作判定邏輯引擎] ── (關節距離、相對倍數判定、防弊機制)
       │
       ├─► [HTML5 Canvas 即時視覺特效] (低延遲視覺/聽覺回饋)
       │
       └─► [Firebase 雲端資料庫] ──► [管理者數據分析中心 (Chart.js + CSV 匯出)]
```

---

## 📊 數據追蹤與分析中心 (Data Analytics Dashboard)
*(基於資訊隱私考量，管理後台不開放線上直接存取，以下為系統功能展示)*

* **客觀量化指標**：自動統計各關卡反應秒數（Reaction Time）、完成率（Success Rate）、每關平均通關耗時。
* **復健歷程折線圖**：透過視覺化圖表追蹤個案長期的反應速度變化趨勢。
* **資料匯出功能**：支援一鍵將全資料庫歷程匯出為標準 `CSV` 格式，便利臨床試驗進行 SPSS / Python 資料科學後續統計分析。

