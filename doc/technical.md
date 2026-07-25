# Technical

## 1. 技术栈

- Vanilla JavaScript ES Modules + Vite 6。
- `gpu-io 0.2.7` 管理 WebGL1/WebGL2 上的浮点纹理、ping-pong GPULayer 和 shader program。
- Gray–Scott 反应扩散 fragment shader 直接改编自 Amanda Ghassaei 的 MIT 示例。
- DOM/CSS 承担标题、计时、幽灵手指、隐藏手势说明、结算和错误恢复；Web Audio API 合成低音量反馈。

## 2. 目录结构

- `index.html`：游戏状态层、无障碍标签、SVG 控件、远程 guest shell 与原作者发表侧署名。
- `src/main.js`：GPU 初始化、shader、参数地图、触控手势、计时计分、暂停策略与音频。
- `src/style.css`：全屏标本式视觉系统、手机安全区、幽灵手指和结算动效。
- `public/alteru.svg`：共享单色 AlterU 水印。
- `doc/`：需求、视觉和技术文档。
- `_qa/ui/`：390×844 与 320×568 的真实运行状态截图。
- `LICENSE`：原作要求保留的 MIT 许可及 Amanda Ghassaei 版权声明。

## 3. 核心模块

- `createPrograms()` 建立双分量浮点状态层、Gray–Scott 更新程序、Chemical B 显示程序、触摸写入程序和视图变换程序。
- `resizeSimulation()` 以屏幕尺寸除以 `SIM_SCALE` 创建随机 A/B 初态；页面尺寸变化后同步画布、状态纹理和像素步长。
- `seedAt()` 将单指/幽灵手指位置换算为画布坐标并通过 `stepCircle` 写入化学状态；真实玩家输入另外记录轨迹与 3×3 多样性区域。
- `applyZoom()` 与 `applyPan()` 沿用原作 K/F 范围变换，并同时变换已有状态纹理，避免双指操作与单指播种冲突。
- `loop()` 每帧执行 6–8 次模拟和一次显示；结算后减半计算步数。
- `IntersectionObserver` 与 `visibilitychange` 在画面低于 35% 可见或页面进入后台时停掉 RAF，同时冻结培养计时，避免列表预加载抢占资源。
- 本作不依赖用户图像或文字，因此不请求 AlterU 头像/用户名接口，也没有网络存档或排行榜。

## 4. 扩展点

- 调整反应形态：修改 `src/main.js` 的 `PARAMS_DEFAULT` 与 shader 中的 Laplacian/反应方程。
- 调整性能：修改 `SIM_SCALE`、`STEPS_PER_FRAME` 和结算态步数。
- 调整玩法：修改 25 秒时长、3×3 区域划分与 `finishIncubation()` 的生命力公式。
- 调整触感：修改播种直径、幽灵轨迹、`tone()` 频率或 `doc/requirements.md` 的反馈映射。
- 调整界面与双语：修改 `src/style.css` 和 `src/main.js` 的 `copy`。
- 发布接入：生成正式 `public/poster.png`，同步 `games/posters/turing-bloom.png`，再向 `games.json` 注册独立 UUID 与仓库地址。
