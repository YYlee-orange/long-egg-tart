# 超长蛋挞：选定纸盒与稍深木桌 v4

本次按用户最新选择，采用上传图片中的蛋挞液纸盒，并把木桌配色稍微调深。当前机器清单是 `asset-manifest-v4.json`，旧稿与 v2 素材包保留。

## 当前使用文件

- 木桌：`backgrounds/wood-table-soft-v4.png`，1920 × 1080，不透明 PNG。由内置 image_gen 调深原背景固有色，保留干净木桌与柔和自然木纹。源图为 `backgrounds/source/wood-table-generated-v4.png`。
- 纸盒原尺寸：`food/custard-carton-approved-v6.png`，1254 × 1254，透明 PNG，与用户选图逐字节相同。永久源文件位于 `food/source/custard-carton-approved-v6.png`，不依赖剪贴板临时路径。
- 纸盒游戏尺寸：`food/custard-carton-48-v6.png`、`64`、`128`、`256`，均为同尺寸正方形透明 PNG。仅去除外围多余透明边距并按比例缩放，保留适当安全边距与原画外观。
- 蛇身：继续使用 `snake/decals-atlas-flat-v5.png`、对应 JSON、独立贴花与 `snake/source/body-geometry-v2.mjs`。统一配色、连续结构与材料坐标规则见保留的 `README-art-assets-v2.md`。

本次纸盒选图保留旋盖厚度、原有配色和柔和面内明暗，以用户这次选择优先于旧版交接中的食物平涂限制。蛇身继续保持已有平涂规范。

## 查看效果

- `../previews/art-assets/assets-overview-v4.png`：新版背景、选定纸盒和现有连续蛇身的组合预览。
- `../previews/art-assets/composition-on-wood-v4.png`：无文字组合图。
- `../previews/art-assets/wood-color-comparison-v4.png`：左为原木色，右为稍深木色。
- `../previews/art-assets/food-alpha-size-v4.png`：选定纸盒的透明轮廓和小尺寸检查。
- `../previews/art-assets/verification-v4.json`：选图原样保留、透明边距和背景配色的验证记录。
- `../previews/art-assets/image-prompt-background-v4.md`：本次内置图像编辑提示词。

当前清单沿用原有蛇身源文件与静态连续性检验，不涉及游戏逻辑、UI 或转场。离线重建本次修订使用 `node art-tools/export-art-v4.cjs`，需要 Node.js 与 sharp；运行后重新进行视觉检查。

