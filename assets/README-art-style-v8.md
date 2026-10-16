# 卡通木板背景与粗线条纸盒 v8

本轮将用户提供的平涂木板图作为明确参考，采用横向宽木板、少量弯曲木纹和稀疏木结。奶黄色蛇身与已有头部使用原文件；蛋挞液沿用本轮制作的暖棕色粗线条试稿。

## 当前文件

- 背景：`backgrounds/wood-table-cartoon-v6.png`，1920 × 1080，不透明PNG。重绘为概括的卡通木板，较原参考柔化木色与线条层次，材质线不承担游戏网格功能。源图在 `backgrounds/source/wood-table-cartoon-generated-v6.png`。
- 用户背景参考：`backgrounds/source/user-wood-reference-v1.png`，原图保留。
- 蛋挞液试稿：`food/custard-carton-outline-v7.png`，1254 × 1254，透明PNG。基于用户选定的v6纸盒，用内置 image_gen 增加暖棕色外轮廓、折顶、旋盖、面板分界和液滴线条；保留原造型与奶黄配色。另附48、64、128、256像素透明版本。
- 当前资产清单：`asset-manifest-v8.json`。旧背景、第一版大色带背景、原纸盒与头部各状态均保留。

## 查看效果

- `../previews/art-assets/art-style-overview-v8.png`：卡通木板、蛇头/蛇身和粗描边纸盒组合。
- `../previews/art-assets/art-style-scene-v8.png`：无文字组合场景。
- `../previews/art-assets/reference-background-comparison-v8.png`：用户参考与重绘背景。
- `../previews/art-assets/background-style-comparison-v8.png`：原密集细木纹与新背景对比。
- `../previews/art-assets/food-outline-comparison-v7.png`：原纸盒、粗线条试稿、现有角色及小尺寸对照。

背景使用内置图像生成工具重新绘制；纸盒使用同一工具编辑原选图。提示词分别保存在 `background-reference-prompts-v6.md` 与 `food-outline-prompt-v7.md`，均位于项目 `previews/art-assets/`。尺寸、透明通道和视觉检查记录为 `art-style-verification-v8.json`。

当前项目已保存全部文件。更新素材包保留项目相对路径，供叠加到原项目使用，包含本轮背景与纸盒修订、预览、源图和清单。角色等未变文件继续使用项目中现有资源。预览导出器读取原项目角色文件；本轮未修改游戏逻辑、UI或转场。
