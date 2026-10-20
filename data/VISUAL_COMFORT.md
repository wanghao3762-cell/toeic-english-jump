# 视觉舒适设计 · 2026-10-20

这是一款学习游戏，不是视力训练或医疗工具。左右折返、不同浮岛间的字号层次是游戏设计，不宣称可降低眼损伤、治疗视疲劳或防治近视。同一屏幕上改变字号不改变真实观看距离，不能代替离屏远眺。

## 参考机构建议

- [AOA：Computer vision syndrome / 20-20-20](https://www.aoa.org/healthy-eyes/eye-and-vision-conditions/computer-vision-syndrome/20-20-20-rule?sso=y)：建议约每20分钟，看20英尺（约6米）外至少20秒；注意反光、照明、阅读距离。此为舒适用眼建议，不保证预防疾病。
- [AOA：Digital eyestrain guidance](https://www.aoa.org/aoa/documents/healthy%20eyes/digital_eyestrain.pdf)：放大文字而不是凑近屏幕、屏幕与环境亮度接近、减少眩光，电脑屏幕通常至少约50厘米远，按个人清晰舒适程度调整。
- [NEI：Dry Eye](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/dry-eye)：长时间屏幕使用可能伴随干眼，限制屏幕时间并休息。
- [AOA：Gamer screen habits](https://www.aoa.org/healthy-eyes/eye-deserve-more/doctor-patient-stories/sharing-safe-screen-habits-with-gamer-and-content-creator-tuonto)：专业人员提示完整眨眼和定时远眺。
- [AAPOS：Vision Therapy](https://www.aapos.org/glossary/vision-therapy)：没有证据表明视觉训练能减缓或改善近视；某些诊断明确的双眼视觉问题有专门医疗训练，不应与游戏混同。

## 本游戏的实现边界

1. 折返路线仍按真实世界坐标提前生成，文字不追逐视线、不在输入时改变大小。可切回居中路线。
2. 默认大字；分层字号仅在新生成的不同浮岛间小幅变化，可关闭。长词换行而非无限缩到小字。
3. 提供减少动态（背景、震动、闪烁光标）选项。2026-10-20动作修订：核心跳跃不再设为零弧度；系统减少动态时改为更低、更短的300ms小跳，且不做落地压缩；一般舒适模式保留较轻的抛物线，背景等非必要动效仍关闭。
4. 默认每20分钟有效学习后提醒离屏远眺20秒，可设10/30分钟或关闭。提醒不抢正在输入的单词或空中跳跃；休息不计分、不惩罚、不改掌握程度。
5. 可以主动休息或稍后5分钟再提醒；网页只能计时，不能确认用户真的看远。20秒后由用户主动继续，不自动开始游戏。
6. 纸色背景和对比度为阅读舒适设计，不宣称蓝光治疗。若持续疼痛、明显模糊或不适，应停止并咨询眼科专业人员。
