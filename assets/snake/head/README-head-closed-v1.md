# 闭嘴状态 v1

直接修改已确认的 v7 矢量原稿，仅闭合嘴部开口、改为细折线嘴缝，再导出透明 PNG。原有张嘴状态保留。

默认闭嘴图片为 `tart-snake-head-left-closed-v1.png`，1120 × 880；对应源文件为 `source/tart-snake-head-left-closed-v1.svg`。另附 up、right、down 三个朝向及各方向的128、256、512像素版本。

颈部仍为头高的80%。完整尺寸、旋转中心、连接锚点和缩放比例与张嘴版一致，运行时仅切换图片。统一状态信息在 `head-states-v1.json`，当前全项目资产清单为 `assets/asset-manifest-v6.json`。

验证对比新旧 PNG 的实际像素，确认变化仅出现在嘴部区域，颈部和眼睛、眉线区域没有变化。所有新图片保留干净透明边距。比较图与检查记录在项目 `previews/art-assets/` 下的 `snake-head-open-closed-v1.png` 与 `snake-head-closed-verification-v1.json`。

原生矢量修改与 PNG 导出脚本为 `art-tools/export-head-closed-v1.cjs`，在项目根目录运行，需要 Node.js 与 sharp；未重新生成整张头部，也未修改游戏逻辑。
