# 第三方内容说明

根目录 `LICENSE` 适用于本项目自行编写的代码和文档。仓库中的游戏数据、图片、角色内容、商标和网站资源保留各自权利人的权利。

## SchaleDB

学生、礼物、制造节点和好感数据，以及大部分学生头像、礼物图标和界面资源，来自 [SchaleDB](https://schaledb.com/) 的公开数据与图片地址。快照时间记录在 `assets/manifest.json` 和 `relationship_data/*.json` 的 `source`、`retrieved_at`、`as_of` 或 `scope.as_of` 字段中。

相关来源：

- <https://schaledb.com/data/jp/students.min.json>
- <https://schaledb.com/data/cn/students.min.json>
- <https://schaledb.com/data/cn/items.min.json>
- <https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/crafting_cn.json>
- <https://schaledb.com/images/>

SchaleDB 数据和图片的授权范围请以其当前仓库、网站说明和上游权利边界为准。项目不将这些内容纳入 MIT License。

## arona.icu 与 Kivo Wiki

[arona.icu](https://arona.icu/) 和 [Kivo Wiki](https://kivo.wiki/) 为交互设计与数据格式的参考来源。项目使用 arona.icu 兼容的库存 JSON 格式，并保留对应的导入/导出能力。仓库不包含这些网站的代码、专属装饰或网站品牌资源。

参考关系不表示合作、授权或从属关系。

## 《蔚蓝档案》内容

《蔚蓝档案》的角色、礼物、图标、文字、美术、商标和其他游戏内容属于相关权利人。本项目是非官方玩家工具，不代表 NEXON、国服运营方或其他官方机构。

Agent 聊天页的 `assets/ui/agent-schale-office.png` 为本项目生成的装饰背景，不是游戏原图，也不代表官方素材。

## 国服官网与社区资料

国服公告链接、中文社区资料和玩家填写值用于记录国服资源的计算方式。每条记录的来源、日期和适用范围保存在对应数据文件中。

## 使用提示

- MIT License 仅覆盖本项目自行编写的代码和文档；
- 对外部署或再分发缓存图片前，请核对各来源当前的服务条款和权利要求；
- 相关权利人如需修改来源标注或移除资源，可以通过项目仓库 Issue 联系维护者。
