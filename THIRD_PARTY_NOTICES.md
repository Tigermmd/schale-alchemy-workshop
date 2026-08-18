# 第三方内容说明

本文件说明仓库中随项目提供的第三方数据、图片和游戏内容。根目录的 `LICENSE` 只适用于本项目自行编写的 HTML、CSS、JavaScript、Python、测试和文档代码，不自动适用于下列内容。

## SchaleDB

学生、礼物、制造节点、好感数据，以及大部分学生头像、礼物图标和界面资源，来自 [SchaleDB](https://schaledb.com/) 的公开数据和图片地址。当前本地快照的抓取时间记录在 `assets/manifest.json` 和 `relationship_data/*.json` 的 `retrieved_at`、`as_of` 或 `scope.as_of` 字段中。

对应来源包括：

- <https://schaledb.com/data/jp/students.min.json>
- <https://schaledb.com/data/cn/students.min.json>
- <https://schaledb.com/data/cn/items.min.json>
- <https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/crafting_cn.json>
- <https://schaledb.com/images/>

SchaleDB 仓库当前没有随 GitHub API 返回的标准开源许可证声明；因此本项目不声称这些游戏数据或图片已获得 MIT 授权。需要再分发、部署或制作衍生站点时，请自行核对 SchaleDB 的当前说明及其上游权利边界。

## Kivo Wiki

部分界面装饰、加载图、反应图标和默认占位图缓存自 [kivo.wiki](https://kivo.wiki/)。具体本地文件和原始 URL 可在 `assets/manifest.json` 中按 `kivo.wiki` 查找。

本项目没有复制 Kivo Wiki 的网站代码，也不主张其图片或商标属于本项目。若权利人要求停止再分发，应移除对应本地资源并更新页面引用。

## arona.icu

少量 Arona 头像、标题和图标缓存自 [arona.icu](https://arona.icu/)，用于界面参考和装饰。具体本地文件和原始 URL 可在 `assets/manifest.json` 中按 `arona.icu` 查找。

本项目参考了 arona.icu 的库存导入/导出和规划交互，但没有复制其站点代码；参考关系不代表合作、授权或从属关系。

## 《蔚蓝档案》及国服官网资源

角色、礼物、图标、文字、美术和其他游戏内容属于其各自权利人。少量国服官网静态资源来源记录在 `assets/manifest.json` 的 `webcnstatic.yostar.net` 条目中；《蔚蓝档案》是相关权利人的作品和商标。本项目是非官方玩家工具，不代表 NEXON、国服运营方或其他官方机构。

## 使用边界

- 不要把第三方数据、图片、角色内容或商标当作本项目 MIT 代码使用许可的一部分。
- 发布本项目的源码版本时，请保留本文件和对应来源字段。
- 对外公开部署前，请根据各来源网站当前的服务条款和权利人要求确认图片是否可以继续随仓库分发；无法确认的资源应改为运行时链接、替换或移除。
- 如果你是相关权利人并希望修改来源标注或移除资源，请通过项目仓库 Issue 联系维护者。
