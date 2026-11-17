# 北歐風客廳｜3D 互動展示

用 Claude Code 搭配 Blender MCP，把室內設計方案做成可以在瀏覽器裡旋轉、點選家具的 3D 互動網站。

- **線上展示**：https://t60011gm.github.io/nordic-living-room-3d/
- **教學影片與講義**：https://t60011gm.github.io/nordic-living-room-3d/course.html

## 功能

- 點選家具：滑鼠移到家具上會亮起，點一下顯示中文名稱、尺寸（公分）與材質
- 沙發換色：淺灰、燕麥米、鼠尾草綠、霧藍
- 地板材質：淺橡木、胡桃木、灰色石材
- 日／夜切換：夜晚環境變暗、立燈亮起
- 視角按鈕：全景、俯視平面、沙發視角

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html`、`style.css`、`main.js` | 網站（Three.js 由 CDN 載入，不需建置工具） |
| `models/living-room.glb` | 網頁用的 3D 模型 |
| `living-room.blend` | Blender 原始檔 |
| `course.html` | 教材頁面 |
| `course/` | 教學影片（含字幕）、講義與簡報 PDF |

## 在自己的電腦開啟

在專案資料夾執行下列指令，再用瀏覽器開啟 http://localhost:8000：

```
python -m http.server 8000
```
