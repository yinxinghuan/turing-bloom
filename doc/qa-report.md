# Visual QA

## Evidence

- `_qa/ui/idle-390x844.png`：修正 guest shell 安全区后的初始/幽灵演示状态。
- `_qa/ui/playing-390x844.png`：真实拖动后的纹样与 24 秒 HUD。
- `_qa/ui/result-390x844.png`：25 秒生命力结算。
- `_qa/ui/idle-320x568.png`：短屏初始状态。

## First pass finding

- P0：390×844 外部打开时，远程 AlterU guest shell 覆盖了左上标题和右上计时。
- 修复：将常规页眉移动到 `safe-area + 72px`，短屏移动到 `safe-area + 66px`；不移动游戏画布。

## Recheck

- 390×844：标题和计时完整可见；单指轨迹启动倒计时；结算卡未遮住重置按钮；无控制台错误。
- 320×568：页面 `scrollWidth=320`、`scrollHeight=568`；标题底部 137 px，重置按钮位于 477–525 px，署名位于 531–555 px，没有重叠。
- 触控目标：重置 48×48 px，结算按钮高 46 px。
- 原作核心视觉：同屏可见点阵、迷宫与连续过渡区；幽灵手指经过处产生真实化学扰动。

## Scores

| Category | Score |
| --- | ---: |
| Hierarchy | 4 |
| Coherence | 5 |
| Readability | 4 |
| Game feel | 4 |
| Asset quality | 5 |
| Responsive UX | 4 |
| Polish | 4 |

平均分 4.29，无低于 3 的项目。
