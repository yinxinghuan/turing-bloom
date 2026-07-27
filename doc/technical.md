# Technical

## 1. 技术栈

Vanilla JavaScript ES Modules、Vite 6、`gpu-io 0.2.7`、Gray–Scott fragment shader、Web Audio API。

## 2. 目录结构

- `index.html`：开放培养状态、SVG 重置控件、guest shell 与署名。
- `src/main.js`：GPU 初始化、shader、参数地图、持续触控手势、暂停策略和音频。
- `src/style.css`：全屏标本视觉、手机安全区、幽灵手指和低干扰活体状态。
- `public/THIRD_PARTY_NOTICES.txt` / `LICENSE`：Amanda Ghassaei、gpu-io 与 MIT 许可。
- `_qa/ui/`：390×844、320×568 的空闲态与长时间重复交互证据。

## 3. 核心模块

`createPrograms()` 建立双分量浮点状态层、Gray–Scott 更新、Chemical B 显示、触摸写入和视图变换程序。`seedAt()` 在按下与移动时写入真实/演示种子，并记录 3×3 区域以生成轻微音阶变化；记录不会导向完成状态。`applyZoom()`、`applyPan()` 处理双指参数空间。应用只保留空闲演示与持续交互两种行为，不存在结算或输入锁；RAF 始终以每帧 6–8 次推进模拟，IntersectionObserver 与 visibility API 在离屏时停止推进。

## 4. 扩展点

- 改反应形态：编辑 `PARAMS_DEFAULT` 与 Gray–Scott shader。
- 调触摸笔刷：编辑 `seedAt()` 的默认直径与 `setValueProgram()` 的 A/B 写入值。
- 调性能：编辑 `SIM_SCALE`、`STEPS_PER_FRAME`。
- 改区域音阶或首次触摸音效：编辑 `seedAt()`、`beginInteraction()` 与 `tone()`。
- 改界面/双语：编辑 `src/style.css` 与 `copy`。
