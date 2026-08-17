# Schale 养成规划工作台

蔚蓝档案国服礼物养成规划器：把学生好感目标、礼物库存、制造期望、周期资源和礼包性价比放在一个本地工作台里计算。页面支持中文、English、日本語，数据默认按中国服快照处理。

当前仓库先以私有仓库形式维护。数据快照、计算口径和礼包内容都应在发布前重新核对；项目不是官方工具，也不代表 SchaleDB 或蔚蓝档案运营方。

## 功能

- 养成规划：计算目标好感缺口、免费资源贡献和预计达成天数；未按国服进度实装的学生只按礼物计算。
- 库存：管理 52 种具体礼物、制造启动石、金色合成石、金色自选盒（100008）和紫色随机盒（100009）。支持 Arona JSON 兼容导入/导出。
- 周期资源：分别记录日程、咖啡厅、制造、活动商店、总力战/大决战和制约解除作战等资源；配置值由玩家自行确认或填写。
- 礼包性价比：按目标学生计算礼物、花束、礼物盒和制造资源的好感/元，只做参考，不自动混入养成规划。
- 学生与礼物图鉴：查看学生反应等级、礼物价值和完整三阶段制造节点期望。
- Agent 助手：通过本机 Harness 连接 OpenAI 兼容接口；模型建议只能经网页确认后修改规划，不能直接改库存或执行代码。

## 快速开始

运行环境：Python 3.10 或更高版本。页面本身不需要安装 npm 依赖。

```bash
git clone git@github.com:Tigermmd/schale-relationship-dashboard.git
cd schale-relationship-dashboard
python3 harness_server.py
```

然后打开：<http://127.0.0.1:8765/>

Harness 同时提供页面和本机 API：

- 页面：<http://127.0.0.1:8765/index.html?view=planner>
- 健康检查：<http://127.0.0.1:8765/api/health>

如果只需要查看页面，也可以运行：

```bash
python3 -m http.server 8765
```

此模式不提供 Agent API。推荐使用 `harness_server.py`，因为它会把 API Key 只保存在代理进程内存中，不写入 localStorage、导出 JSON、URL 或日志。服务只监听 `127.0.0.1`。

自定义端口：

```bash
SCHALE_HARNESS_PORT=8766 python3 harness_server.py
```

## 测试

```bash
node --test js/*.test.mjs
python3 -m unittest -v test_harness_server.py
python3 -m py_compile generate_dashboard_assets.py harness_server.py test_harness_server.py
git diff --check
```

## 项目结构

```text
index.html                 页面入口
styles.css / agent.css     工作台与 Agent 样式
js/                        状态、计算、视图和测试
relationship_data/         国服礼物、学生、阈值、制造、资源与礼包快照
assets/                    学生、礼物、反应脸和 UI 图片缓存
harness_server.py          本机页面服务器与 Agent 代理
generate_dashboard_assets.py 生成/检查本地图片清单
```

## 数据和计算口径

- 中文名称和国服快照以 SchaleDB CN 数据为基础；数据来源、抓取时间和待确认边界记录在 `relationship_data/*.json` 的 `source` 字段及 `relationship_data/README.md`。
- 制造石只作为第一阶段启动成本；第二、三阶段使用的其他材料不进入制造石效率分母。
- 每个制造阶段从可能节点中生成五个候选，再按学生好感价值选择候选；不是礼物的产物直接按零好感处理。
- `100008` 永远是金色礼物自选盒；`100009` 永远是紫色礼物随机盒。随机盒只计算期望，不伪装成具体礼物库存。
- 规划预览不自动扣库存；只有确认消耗后才会处理具体礼物预留。

## 本地状态与隐私

库存、规划和语言设置保存在浏览器本地。仓库不包含个人库存 JSON、API Key 或账号同步服务。提交前请确认没有把 `.env`、私钥、个人导出文件或浏览器数据放进仓库。

## 数据更新

重新生成 SchaleDB 快照前，请先确认中国服版本边界并保存来源信息：

```bash
python3 relationship_data/generate_relationship_data.py --server cn --output-dir relationship_data
python3 relationship_data/crafting_expected_relationship.py
python3 generate_dashboard_assets.py
```

重新生成会覆盖快照文件；请先在独立分支检查差异并重新运行全部测试。国服礼包、活动和周期资源中的用户确认值不能被自动当成官方数据。

## Agent Harness

网页使用以下本机接口：

```text
GET  /api/health
POST /api/config
POST /api/config/test
POST /api/chat
```

Agent 上下文包含当前规划和本地计算结果。模型返回的建议会经过结构校验，网页只允许应用目标学生、目标等级、规划天数、国服截止学生和礼包计划变更；库存、已购买事实和任意 JavaScript 不在允许范围内。

## 开源状态

当前仓库为私有开发仓库，许可证尚未确定。公开发布前需要再次核对数据授权、图片来源、国服快照和许可证，并补充贡献指南与变更记录。
