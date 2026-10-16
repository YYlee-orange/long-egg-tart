# 美术统一修订 v7

按用户本轮反馈重绘木桌，并给选定的蛋挞液素材增加粗线条。当前接入清单为 `asset-manifest-v7.json`，蛇身、张嘴与闭嘴蛇头沿用原有文件。

## 木桌大色块重绘

使用 `backgrounds/wood-table-blocks-v5.png`，1920 × 1080，RGB不透明PNG。由内置 image_gen 重新绘制，去掉细木丝和密集纹理，只保留顶部、底部少量宽缓木色带，中心大面积安静留白。木色保持温暖、低饱和，画面没有道具、网格或板缝。

源图为 `backgrounds/source/wood-table-blocks-generated-v5.png`。生成器仍有极轻微面内色调漂移，但没有细碎纹理或固定方向光。提示词和检查记录位于 `../previews/art-assets/background-blocks-prompts-v5.md`。旧背景保留用于对照。

## 蛋挞液粗线条试稿

使用 `food/custard-carton-outline-v7.png`，1254 × 1254，透明PNG。基于用户选定的 `custard-carton-approved-v6.png` 用内置 image_gen 编辑，保留纸盒、旋盖、液滴与奶黄配色，增加暖棕色外轮廓和关键结构粗线。此项为用户要求的描边效果试稿，原选图保留。

另附 `custard-carton-outline-48-v7.png`、`64`、`128`、`256` 四种透明游戏精灵，仅规范透明边距并按比例缩放。源图在 `food/source/custard-carton-outline-generated-v7.png`；提示词见 `../previews/art-assets/food-outline-prompt-v7.md`。

## 查看与接入

- `../previews/art-assets/art-style-overview-v7.png`：新木桌、角色和粗线条纸盒组合。
- `../previews/art-assets/art-style-scene-v7.png`：无文字的组合场景。
- `../previews/art-assets/background-style-comparison-v7.png`：原背景和大色块背景并排对比。
- `../previews/art-assets/food-outline-comparison-v7.png`：原纸盒、粗线条试稿、现有角色和实际像素尺寸对照。
- `../previews/art-assets/art-style-verification-v7.json`：尺寸、透明边距和视觉检查记录。

原生预览SVG与导出脚本 `art-tools/export-style-revision-v7.cjs` 一并保存。在项目根目录运行，需要 Node.js 与 sharp；导出预览还会读取现有角色文件。此轮只更新素材与资产清单，不修改游戏逻辑、UI或转场。
