# 蔚蓝档案：礼物与好感数据快照

这组文件是给制造/好感模拟器使用的中国服当前版快照，中文来自 SchaleDB CN，英/日名称用于页面切换；生成时间和 SchaleDB build 写在每个 JSON 的 `source` 字段中。

## 文件

- `gifts.json`：当前数据源中的 52 个礼物，含英文名、SchaleDB CN 区域中文名、双语描述、SR/SSR、Quality、基础 EXP 和内部 Tags。
- `student_gift_preferences.json`：中国服 `IsReleased[2] == true` 的 212 个学生条目，包含服装变体；每个条目既有英文名、SchaleDB CN 区域中文名，也有完整的 `gift_values`（52 个礼物对该学生的实际 EXP）和筛出的偏好礼物。
- `relationship_thresholds.json`：好感 1–100 级的单级需求与累计 EXP，以及双语礼物反应标签、礼物/咖啡点击/日程 EXP。
- `crafting_expected_relationship.json`：完整第 1、2、3 阶段都推进时，每个学生按 SchaleDB 各阶段节点权重生成 5 个候选节点、择优选择后的期望好感 EXP。
- `paid_packages_cn.json`：中国服官方礼包目录叠加用户确认的规划口径；当前记录每月制造/礼物礼包、限定/FES 学生礼物礼包和 156 元制造礼包的价格、限购与礼物相关内容，盒内期望使用 `gift_boxes_cn.json` 的用户确认模型。
- `gift_boxes_cn.json`：礼物盒的 CN 物品定义和用户确认的计算池。所有服务器共用同一套物品 ID；`100000` 是 35 个可制造金色礼物（`5000`–`5034`）等概率随机，`100008` 可从这 35 个金色礼物中自选，`100009` 是 13 个可制造紫色礼物（`5100`–`5112`）等概率随机；每盒按 1 个礼物计算。这里的池和概率是用户确认模型，不等同于国服官方概率附件。
- `cn_planner_data_to_fill.md`：只收集尚未能从国服公开资料稳定确认的周期资源、礼物盒概率、日程/咖啡厅摸头和氪金礼包字段，供补充后接入规划器。
- `resource_evidence_cn.json`：当前检索到的国服资源候选线索；所有 `lead` 值只展示、不计入规划计算，且会标明“每次活动 / 每99层 / 每张日程券”等口径。活动商店按每月 2 次等效折算为随机金礼物盒 80 个、随机紫礼物盒 4 个，并在账本中拆成两行。
- `unlimited_assault_rewards_cn.json`：从中国服中文社区“新版奖励”表提取的制约解除决战 1–124 层完整记录；保留原表的其他材料、装备自选、WB 字段，并单独汇总礼物盒与金色合成石楼层。官方只确认 124 层和五个组别，因此当前仍不自动计入资源期望。
- `schedule_rank_rewards_cn.json`：日程总地区 Rank 1/10/25/50/80 的每日券数、单地区 Rank 1–12 的基础/额外好感、奖励概率提升、区域增加和最高档期望；默认最高档为总 Rank 80、7 张/天、约 218.75 好感/天，但玩家自填次数优先。
- `student_crafting_expectations.csv`：简洁中文表格；每行一个学生，包含三阶段期望好感、每枚制造石期望好感，以及按 240/180/120/80/60/40/20 好感值分列的中文礼物信息。120 好感值统一用“其他紫礼物”表示，20 好感值统一用“其他金礼物”表示；其他档位列出具体中文礼物名称。
- `generate_relationship_data.py`：从 SchaleDB `data/en` 和 `data/cn` 实时 JSON 重新生成快照。
- `crafting_expected_relationship.py`：读取 SchaleDB CN 制造数据并重新计算三阶段“五选一”择优结果。

## 本地可视化页面

本目录是页面使用的数据快照，不单独启动服务。请在仓库根目录阅读 `README.md`，并运行：

```bash
python3 harness_server.py
```

然后打开 <http://127.0.0.1:8765/>。页面会读取本目录的中国服 JSON 快照；`generate_dashboard_assets.py` 负责生成学生头像、礼物图标和制造节点图的本地清单。

## 三阶段制造效率口径

制造石只计入启动第 1 节点：1 枚制造石等于 10 个制造石碎片。第 2、3 节点按用户指定视为使用其他游戏内材料，且这些材料不进入制造石效率分母。因此：

- 第 1 阶段制造石成本：1；
- 第 2 阶段制造石成本：0；
- 第 3 阶段制造石成本：0；
- 完整三阶段的 `relationship_exp_per_manufacturing_stone` 等于三个阶段期望好感 EXP 之和。

每个阶段先按 SchaleDB 的 `Node.Weight / TotalWeight[tier - 1]` 独立生成 5 个候选节点，玩家从 5 个候选中选择本生徒期望好感最高的节点；被选中的节点再按组权重、物品权重和数量区间计算奖励期望。因此，某一级可能 5 个候选都不是礼物节点，不能把礼物节点当作必出，也不能从全体节点中自由挑选最佳节点。三个阶段各贡献一个被选节点的结果，期望值相加；阶段 1 的制造石成本仍为 1，阶段 2、3 的其他材料不计入分母。

节点礼物产出按节点内部的 Groups/Items 权重逐层判断，而不是按节点名称硬编码：第 1 阶段的 `光芒` 和 `花` 节点可能产出礼物；第 2 阶段的 `光芒`、`花` 以及专门礼物节点可能产出礼物；第 3 阶段的 `闪亮`、`灿烂` 和 `花` 节点可能产出礼物。第 1、2 阶段的 `灿烂` 节点即使名称相同也不计入礼物产出，第 3 阶段才计入。任何不是礼物的产出都直接舍弃，按 0 好感值和 0 礼物数量处理；不需要用户补录非礼物概率。每个学生都用其自身对礼物的好感值为节点打分，再对五个候选节点进行期望值择优。

字段约定：

- `name_en` / `name_zh_cn`：英文和简体中文名称。
- `desc_en` / `desc_zh_cn`：礼物英文和简体中文描述。
- `reaction_label_en` / `reaction_label_zh_cn`：Small/Medium/Large/Huge 与 小/中/大/特大。
- `name_zh`、`reaction_label_zh` 是旧模拟器消费者可用的兼容别名；新代码应使用带语言后缀的字段。

## 礼物匹配规则

规则来自 SchaleDB 的 `StudentGifts` 页面代码，而不是手工按攻略表抄录：

1. 学生的 `FavorItemTags` 与 `FavorItemUniqueTags` 合并，再加入通用高级礼物 Tags `BC`、`Bc`、`ew`。
2. 计算礼物 Tags 与上述集合的交集，最多计 3 个匹配。
3. 反应等级为 `匹配数 + 1`，并排除没有超过礼物自身通用标签基线的项目。
4. EXP 为 `gift.ExpValue × (1 + min(匹配数, 3))`。

因此这里不把“喜欢/最喜欢”压缩成一个二值字段：

- `reaction_grade=2/3/4` 对应游戏反应“中/大/特大”；
- `relationship_exp` 是模拟器应直接增加的数值；
- `most_favorite_gifts` 是 `reaction_grade=4` 的礼物 ID；
- `is_premium=true` 表示数据项为 SSR 高级礼物，不等同于“对该学生反应特大”。
- `is_universal=true` 表示该礼物命中了通用高级礼物标签；这包括普通高级礼物的全员“中”档基线，以及花束/写真卡的全员固定档位。

普通 SR 礼物即使没有学生偏好，`gift_values` 仍会记录基础 20 EXP；普通高级礼物没有额外学生标签时仍会记录 120 EXP。这样模拟器不需要对未命中项再猜默认值。

## 好感阈值说明

礼物 EXP 的公开攻略数据为：普通礼物 20/40/60/80，高级礼物 120/180/240；咖啡点击每次 15，日程通常为 15–25，Bonus 时翻倍。

好感等级表来自日文 Wiki 的 `SandBox/絆ランク`，该页明确标注为非官方公开数据的玩家验证表。`relationship_level_cap=100` 是好感等级上限口径；`stat_bonus_level_cap=50` 是当前 SchaleDB 配置中的属性加成上限，二者不要混为一谈。100 级行保留来源表的 7365 “下一档”数值，但模拟器将 100 视为不可继续升级。

## 当前数据边界

当前中国服快照只保留 SchaleDB CN `IsReleased[2]` 标记已实装的学生。若某个学生没有任何礼物 Tags 与学生偏好 Tags 匹配，文件会保留该学生但将 `no_matching_gift_in_source=true`；这表示“当前数据源没有可匹配记录”，不是对游戏设计的无条件断言，尤其联动学生应在后续数据更新时复核。

## 来源

- [SchaleDB 英文礼物数据](https://schaledb.com/data/en/items.min.json)
- [SchaleDB 英文学生数据](https://schaledb.com/data/en/students.min.json)
- [SchaleDB CN 区域礼物数据](https://schaledb.com/data/cn/items.min.json)
- [SchaleDB CN 区域学生数据](https://schaledb.com/data/cn/students.min.json)
- [SchaleDB 配置](https://schaledb.com/data/config.min.json)
- [SchaleDB 制造数据](https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/crafting_cn.json)
- [SchaleDB 制造页面](https://schaledb.com/crafting)
- [制造机制说明（节点五选一、阶段产出）](https://bluearchive.wikiru.jp/?%E8%A3%BD%E9%80%A0)
- [制造阶段消耗说明](https://www.taptap.cn/moment/438067301988698078)
- [SchaleDB StudentGifts 匹配代码](https://schaledb.com/assets/StudentGifts-8fad62db.js)
- [Blue Archive Wikiru：贈り物](https://bluearchive.wikiru.jp/?%E8%B4%88%E3%82%8A%E7%89%A9)
- [Blue Archive Wikiru：絆ランク验证表](https://bluearchive.wikiru.jp/?SandBox/%E7%B5%86%E3%83%A9%E3%83%B3%E3%82%AF)

中文字段明确使用 SchaleDB 的 `data/cn` 区域数据，不使用 `data/zh`。`data/cn` 与 `data/zh` 是不同本地化数据集；本项目按用户确认只维护中国服数据，生成命令固定使用 `--server cn`。
