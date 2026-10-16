# 蛋挞蛇弹窗美术交接 v1

暂停与结算共用酥皮面板和小蛇装饰，配有主/次按钮各四种状态。文字、图标和最终长度均独立于底图。

先阅读`PROGRAMMER-HANDOFF-v1.md`。完整切片尺寸、颜色和状态文字在`dialog-assets-v1.json`。

在解压后的根目录打开`previews/dialogs/dialog-reference-v1.html`可以切换暂停/结算、输入长度并查看按钮交互，无外部网络或字体依赖。示例按钮只演示交互；参考页控制栏不接入游戏。两张整屏预览、两张弹窗近景、对比图、焦点与小屏预览都在同目录。

SVG来源与生成原稿保存在`source/`；内置image_gen提示词保存在`previews/dialogs/dialog-prompts-v1.md`。PNG已检查透明外缘；交互参考通过23项检查。导出/验证脚本供原项目环境复现，实际接入请按程序交接文档完成状态和层级对接。
