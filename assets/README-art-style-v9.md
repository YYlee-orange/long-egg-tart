# 红色野餐布背景 v9

本轮按用户参考改为正俯视的柔和红白交织野餐布，并按最新修正将横纵织带宽度都设为一格。四周各留一格给白色花边；角色与粗描边蛋挞液沿用原文件。

- 背景：`backgrounds/picnic-cloth-flat-v1.png`，1920×1056，不透明PNG。
- 逻辑尺寸版：`backgrounds/picnic-cloth-flat-960-v1.png`，960×528，与20×11格、48像素逻辑格匹配。
- 可编辑定稿：`backgrounds/source/picnic-cloth-flat-v1.svg`，纯色块构成，无纹理、渐变或描边。
- 布局数据：`backgrounds/picnic-cloth-layout-v1.json`。高清版每格96像素，白边96像素，中央18×9格；横纵织带均96像素。18×9指可见布面，未改变游戏地图、碰撞或关卡数据。
- 白色花边的圆瓣与浅色孔形均位于最外一圈，四角保留花纹。中间彩色条纹不会侵入花边。
- 组合预览：`../previews/art-assets/art-style-scene-v9.png`；逻辑尺寸预览：`../previews/art-assets/picnic-game-scale-v1.png`。
- 清单：`asset-manifest-v9.json`；验证记录：`../previews/art-assets/art-style-verification-v9.json`。

内置image_gen生成了野餐布方向稿及一格织带修订，原样保存在`backgrounds/source/picnic-cloth-generated-study-v1.png`和`v2.png`。为精确固定格数、边宽并消除生成稿的浅渐变，按生成稿花边造型制作了SVG定稿。完整提示词和定稿规范见`../previews/art-assets/picnic-cloth-prompts-v1.md`。

之前的木桌、食物和角色各稿均保留。当前工作只生成背景素材与离线组合预览，未修改游戏逻辑、UI或转场。
