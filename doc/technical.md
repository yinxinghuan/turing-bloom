# Technical

## 1. 技术栈

Vanilla JavaScript ES Modules、Vite 6、`gpu-io 0.2.7`、Gray–Scott fragment shader、Web Audio API。

## 2. 目录结构

- `index.html`：成熟度 HUD、标本结算、SVG 控件、guest shell 与署名。
- `src/main.js`：GPU 初始化、shader、参数地图、触控手势、成熟判定、暂停策略和音频。
- `src/style.css`：全屏标本视觉、手机安全区、幽灵手指和标本标签。
- `public/THIRD_PARTY_NOTICES.txt` / `LICENSE`：Amanda Ghassaei、gpu-io 与 MIT 许可。
- `_qa/ui/`：390×844、320×568 和成熟结算证据。

## 3. 核心模块

`createPrograms()` 建立双分量浮点状态层、Gray–Scott 更新、Chemical B 显示、触摸写入和视图变换程序。`seedAt()` 写入真实/演示种子并记录 3×3 区域；`applyZoom()`、`applyPan()` 处理双指参数空间。`updateMaturity()` 按轨迹距离与区域数计算 0–100 成熟度，达到 100 且静置 1.8 秒后按覆盖特征生成 `CELLULAR / CORAL / LABYRINTH` 标本。RAF 每帧执行 6–8 次模拟；IntersectionObserver 与 visibility API 在离屏时停止推进。

## 4. 扩展点

- 改反应形态：编辑 `PARAMS_DEFAULT` 与 Gray–Scott shader。
- 调成熟速度：编辑 `updateMaturity()` 的 `0.12`、`12` 与静置 1800 ms。
- 调性能：编辑 `SIM_SCALE`、`STEPS_PER_FRAME`。
- 改标本命名或音效：编辑 `finishIncubation()`、`tone()`。
- 改界面/双语：编辑 `src/style.css` 与 `copy`。
