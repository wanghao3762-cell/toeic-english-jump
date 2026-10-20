# GitHub Pages 发布验收 · 2026-10-20

## 发布目标

- 既有仓库：[wanghao3762-cell/toeic-english-jump](https://github.com/wanghao3762-cell/toeic-english-jump)
- 站点：[TOEIC 跳一跳](https://wanghao3762-cell.github.io/toeic-english-jump/)
- 配置：公开仓库，main分支根目录，legacy Pages构建；沿用HTTPS与原地址，无自定义域名和新增服务。
- 应用提交：`757766e5b6217dee44706599e2e9e028d1100f0a`。正常推送自2726f6d，无强推。GitHub Pages API返回相同commit且status=built。
- 此报告及最终截图单独补充提交，不改变已验收的应用代码。

## 发布前

1. `node tools/test.js`：66项通过。
2. `python -X utf8 tools/audit_vocab.py`：4129唯一词，源覆盖、字段、哈希、联想链接检查均通过。
3. `python -X utf8 tools/build_standalone.py` 与 `node tools/check_standalone.js`：1,541,425字节，6段脚本内嵌、语法与源代码一致。
4. 待发布文件凭据模式扫描无命中。没有上传聊天凭据、65MB词典原始CSV、独立参考仓库、WorkBuddy数据或中间动画抓帧；没有删除这些本机文件。
5. 旧站HTTP200、text/html，无Content-Disposition attachment头；Pages源配置和远端分支均核实。匿名Pages配置API返回404，使用本机已有Git授权只读核验后成功，没有索取或保存新的聊天凭据。
6. 入口脚本统一增加`?v=20261020-jump2`，导出器兼容查询参数，减少发布后旧缓存混用。

## 线上资产

运行 `powershell -File tools/verify_release.ps1 -Release 757766e5b6217dee44706599e2e9e028d1100f0a` 成功，9个文件均HTTP200且规范换行后的SHA256与本地一致，无attachment下载头：

- index.html
- vocabulary.js、learning.js、ascent.js、memory.js、comfort.js、app.js
- data/vocabulary.json
- 托业英语跳一跳.html

关键哈希：

| 文件 | SHA256（统一LF后） |
|---|---|
| index.html | 1bc6c756340bd2dd446ec1cf63ffc846a137d87ac1b210f92f00a6ef932a63dd |
| app.js | 5436e109f446e8f45d635fbde79e1b40f8bf172e4e02378144dbf8d8730d10c6 |
| 离线单文件 | e054254ec136a14560d7693066fabb05f33d412417bf662c7baebc07a8cb3202 |

## 线上浏览器

实际访问GitHub Pages入口（不是本地预览），完成15跳、进入第2组、0→851米；输入、渐隐提示、无限组衔接正常。联想卡可打开/关闭，舒适设置显示当前“系统减少动态时使用更短、更低的小跳”说明。DOM的6个脚本src均为20261020-jump2版本；控制台error/warn为空。刷新页面后攀登高度仍851米，菜单中的舒适设置可用。

截图：[线上游戏](release-live.png)。详细浏览器记录：`release-browser.json`。

## 安全与局限

使用本机现有Git Credential Manager授权，原origin保持不含凭据的HTTPS地址；API读取所需凭据仅在进程内存中使用且不输出、不写项目文件。用户粘贴到聊天的凭据已提示立即撤销，本报告不记录其值。

实际浏览器为内置浏览器，未声称Chrome实机验证。在线与离线仍按各自浏览器存储保存，不新增账号或跨端同步；同一在线域名的旧进度不因本次更新而主动清空。
