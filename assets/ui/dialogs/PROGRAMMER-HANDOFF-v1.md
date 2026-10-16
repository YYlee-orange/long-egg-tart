# 暂停与结算弹窗：程序接入说明 v1

这是美术交接包：包含透明皮肤、装饰小蛇、图标、可交互HTML/CSS参考和本说明。游戏运行代码尚未应用此设计。先打开`previews/dialogs/dialog-reference-v1.html`查看两种状态；两张近景和整屏预览在同目录。参考页可直接在本地浏览器打开，无网络依赖。

## 一、层次与状态

两种状态共用酥皮边框、奶油面板、小蛇装饰及两个按钮。动态内容均由程序绘制。

- 暂停：标题“已暂停”，提示“歇一会儿，继续变长。”；隐藏分数区域。左侧“回到开始界面”，右侧“继续游戏”，主按钮配播放图标。
- 结算：标题“本轮结束”，分数区标签“最终长度”，显示实际`game.snake.length`；隐藏暂停提示与暂停小标。左侧“回到开始界面”，右侧“再来一次”，主按钮配重试图标。
- 预览中的13只是示例，不写死；没有新增积分、纪录、奖励或长度单位。

## 二、素材与切片

所有路径相对项目根目录。机器可读尺寸与颜色以`assets/ui/dialogs/dialog-assets-v1.json`为准。

- `panel-frame-v1.png`：1280×960，2倍图，奶油中心已填实；九宫格切片为上/右/下/左各128源像素，渲染边宽各64 CSS像素。圆角、烤斑保留在固定角块内，中间和直边伸展。
- `mascot-v1.png`：960×347，透明装饰图；`mascot-480-v1.png`：480×174。正常显示宽216 CSS像素、高约78，不参与切片，不因面板增高而拉长。
- `button-primary-{default,hover,pressed,disabled}-v1.png`：主按钮四状态，480×112，2倍图，基准显示240×56。
- `button-secondary-{default,hover,pressed,disabled}-v1.png`：次按钮四状态，规格相同。
- 按钮九宫格源切片按上/右/下/左为48/64/48/64像素；显示边宽24/32/24/32 CSS像素。
- `icon-home-v1.svg`、`icon-play-v1.svg`、`icon-retry-v1.svg`：按钮图标，20×20 CSS像素。`icon-pause-v1.svg`用于暂停标记，21×21。图标已配好固有色，可用普通`img`，无需CSS mask或滤镜。
- `source/`内保留面板与全部按钮的可编辑SVG、装饰原稿和改版前截图。图标复用Phosphor，许可在`assets/ui/PHOSPHOR-LICENSE.txt`。

CSS切片示例，URL须按实际样式文件位置调整：

```css
.dialog-skin {
  border: 64px solid transparent;
  border-image: url('panel-frame-v1.png') 128 fill / 64px / 0 stretch;
}
.button-skin {
  border-style: solid;
  border-color: transparent;
  border-width: 24px 32px;
  border-image: url('button-primary-default-v1.png')
    48 64 48 64 fill / 24px 32px / 0 stretch;
}
```

Web建议把皮肤放在绝对定位的装饰层上，内容另起一层，避免64像素切片边宽挤占内容。Unity/其他引擎按同一源像素边界设置9-slice，UI尺寸换算为1倍单位。不要把整张面板当背景图直接非等比拉伸。

## 三、布局与排版

正常模式的外框总宽最大560 CSS像素；随内容自然增高。参考页暂停约302高，结算约418高，均包含顶部小蛇。不要固定总高度，也不要把文字位置换算为截图上的百分比。

- 弹窗相对可用区域居中，外侧至少留16像素。
- 小蛇位于外框顶部中央，top=0，width=216。面板皮肤从top=38开始，小蛇与边框轻微交叠。
- 内容padding为上118、左右32、下28。
- 标题30像素、800字重、行高1.3，颜色`#765238`；提示16像素、行高1.5，颜色`#8C6A4D`。
- 按钮高56像素，字16像素/700，图标20像素，图文间距8像素，左右按钮间距16像素。标签保持单行。
- 结算数字区宽230像素，内边距12/18/14，圆角28，底色`#F7E6BC`、2像素边`#D8B17A`。标签16像素；数字72像素、800字重，使用等宽数字特性。
- 数字1至3位用72像素，4至5位用56像素，6至8位用36像素。更长数据继续按可用宽度缩字号或适当加宽数字区；不截断、不用省略号、不修改真实数值。

参考字体为Microsoft YaHei UI/Microsoft YaHei/PingFang SC/system-ui；数字优先Trebuchet MS并有系统回退。字体是运行时文字，不依赖生成图片里的文字。

## 四、与当前代码对接

保留当前`#overlay`、`#modal-title`、`#final-length`、`#home`、`#continue`的ID和已有事件监听。给面板添加`.tart-dialog`，增加`.dialog-skin`、`.dialog-mascot`以及数字区包裹层；给按钮加`.dialog-action`与主/次类名。参考HTML展示完整结构。

当前`src/main.js`的`syncUI()`直接设置`continueButton.textContent`。接入图标后，必须改为更新按钮内的标签span，否则每次同步都会把图标删掉。状态更新的示意如下，节点变量须在实际DOM准备好后获取：

```js
const paused = game.status === 'paused';
modalPanel.dataset.state = paused ? 'pause' : 'result';
modalTitle.textContent = paused ? '已暂停' : '本轮结束';
pauseDescription.hidden = !paused;
scoreWrap.hidden = paused;
finalLength.hidden = paused;
finalLength.value = String(game.snake.length);
finalLength.textContent = finalLength.value;
continueLabel.textContent = paused ? '继续游戏' : '再来一次';
continueButton.setAttribute('aria-label', continueLabel.textContent);
continueIcon.src = paused ? playIconPath : retryIconPath;
finalLength.style.setProperty('--score-size',
  finalLength.value.length >= 6 ? '36px' :
  finalLength.value.length >= 4 ? '56px' : '72px');
```

只隐藏`output`还会留下空分数框，因此要同时切换`scoreWrap.hidden`。标题h2与图标使用并列节点，避免`modalTitle.textContent`删除图标。实际长度直接读取游戏状态；参考页中的长度输入和示例操作反馈不接入游戏。

`dialog-style-v1.css`是设计参考，其中`body`、`.reference-*`、`.preview-stage`和`.demo-reopen`属于演示工具。接入时只取弹窗组件、按钮、状态及适配规则，并调整素材URL；不要整份覆盖现有游戏样式。参考页给容器命名`dialog-stage`，应用容器查询时也要为实际舞台设置相应`container-name`和`container-type:size`。

## 五、输入、焦点与层级

- 暂停时冻结移动和倒计时；结算时游戏保持终止状态。沿用现有状态逻辑，不由美术组件另起计时器或重复启动循环。
- 主按钮：暂停时调用现有继续流程；结算时调用现有重新开始流程。次按钮沿用现有回到开始界面流程。
- 弹窗打开后焦点给主按钮，Tab/Shift+Tab只在可用操作之间循环；Enter/Space使用原生按钮行为。暂停时Esc继续；结算时Esc不重启。点击遮罩不关闭，不新增关闭叉号。
- 沿用dialog语义，`aria-modal=true`，通过`aria-labelledby`指向标题。只保留一个dialog角色；装饰小蛇、皮肤和图标不朗读，图像alt为空。
- 焦点圈单独由`:focus-visible`绘制，2像素`#765238`、offset 4像素。它不是PNG边框，不要再套多重焦点描边。
- 过渡处理中禁用两个按钮，防止重复操作；禁用时替换对应disabled皮肤。指针悬停换hover，按下换pressed并向下移动2像素。
- 层次保持“游戏画面/HUD < 遮罩与弹窗 < 转场遮罩”。当前`.curtain`的z-index为1，不能仅复制参考页的弹窗z-index=2而让转场落到弹窗后面。若用视口UI层，主页/重开转场开始前先收起弹窗；全局UI层由程序统一管理。
- 打开弹窗时禁用背景游戏输入。关闭后将焦点交回游戏舞台或开始按钮，沿用当前事件流程。

## 六、遮罩、动效与小屏

遮罩用`rgba(64,42,32,0.24)`，游戏底图轻微模糊3像素即可。移动端可关闭模糊节省性能；面板本身保持清晰。不要把遮罩或焦点圈烘焙进PNG。

弹窗建议160毫秒淡入，Y从6到0、scale从0.98到1，无反复弹跳。动画只用opacity/transform；`prefers-reduced-motion:reduce`时立即显示。

舞台可用高度≤440像素或视口高度≤520像素时进入紧凑模式：隐藏顶部小蛇，皮肤top归零，内容padding改为28/24/24，标题26，提示14，数字最大60，按钮间距12。优先保留状态、数字和操作。

舞台宽≤360像素时两按钮改竖排，主按钮优先显示，触摸热区仍不小于44像素。参考按钮实际高56。面板内宽不够时优先调整布局，不能把按钮文字挤成两行。

手机竖屏的20×11游戏舞台很矮，弹窗需要覆盖整个视口。可用独立视口UI层/portal，使其不受舞台`overflow:hidden`裁切；同时处理上述转场层级。弹窗最大高为视口减32像素，必要时内容可滚动，操作必须可达。参考页在小屏/低视口下演示这一布局。

## 七、已验证与验收

已在本机Edge参考页中验证：0、13、999、12345、12345678的数字显示；390×844、360×780及844×390三个视口；Tab循环、返回焦点、暂停Esc继续、结算Esc保持、遮罩不关闭及主按钮示例事件。启用按钮与副文案的文字对比均达到4.5:1；记录见`previews/dialogs/asset-verification-v1.json`。

接入实际游戏后，程序仍需核对：真实暂停期间时间不流逝；继续不会重新开局；结算数字正确；重开和回主页沿用原转场；弹窗输入不会穿透到蛇；小屏下两个操作可达。设计参考中的按钮只演示动作，不包含游戏实现。
