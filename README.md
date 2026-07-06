# 日韓旅行支出

這是一個純靜態旅行支出網頁，用來分開記錄 2026 日本與 2026 韓國旅行支出。

## 頁面

- `index.html`: 入口選單
- `japan.html`: 日本支出頁，只新增與顯示日幣支出
- `korea.html`: 韓國支出頁，只新增與顯示韓幣支出

人員清單與 JSON 備份資料共用；摘要、結算、搜尋、CSV 匯出則只針對目前頁面。

## 功能

- 新增人員
- 新增支出名稱、日期、金額、付款人、分攤人員、備註
- 日本頁使用日幣 JPY，韓國頁使用韓幣 KRW
- 自動計算誰應收、誰應付、誰該付誰
- 可設定台幣估算匯率
- JSON 完整備份與匯入
- CSV 匯出目前頁面的支出
- PWA 離線快取

## 使用方式

直接開啟 `index.html`，再選擇日本或韓國頁面。

資料會儲存在目前瀏覽器的 `localStorage`。這適合長期保存於同一台手機或電腦，但不等於雲端同步。建議旅行中定期匯出 JSON 備份。

## 免費雲端部署建議

建議使用 GitHub Pages：

1. 建立一個公開 GitHub repository。
2. 上傳本資料夾內所有檔案。
3. 到 repository 的 `Settings` > `Pages`。
4. Source 選 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/root`。
6. GitHub 產生網址後，即可用瀏覽器開啟。

GitHub Pages 目前在 GitHub Free 的公開 repository 可用。供應商政策可能未來調整，因此無法保證永久免費；若要提高長期可攜性，請保留本專案檔案與 JSON 備份。
