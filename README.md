# 算力坐标 Compute Axis

查硬件规格，按准备部署的模型筛选设备，对比 Artificial Analysis 的模型评测。

[硬件对比](#硬件对比) · [硬件选型](#硬件选型) · [模型对比](#模型对比) · [部署](#部署)

## 硬件对比

目录收录 329 款硬件。可以按型号、厂商和类别筛选，显存图、内存带宽图与规格表同步更新。图表提供线性刻度和低值放大。

![硬件对比页的显存容量和内存带宽图](docs/screenshots/hardware-comparison.png)

## 硬件选型

可以搜索 5,056 个模型条目，按 Q4、Q6、Q8、FP16 估算显存并筛选候选配置。默认展示 Qwen3.8-27B。生成速度是基于内存带宽的估算，实际部署需核对上下文、推理框架、驱动和多卡互联。

![Qwen3.8-27B 的容量估算和候选硬件](docs/screenshots/hardware-advisor.png)

## 模型对比

展示智能指数、任务成本与耗时、输出 Token、成本效益和六领域排名。默认筛选可本地部署的模型，可切换到全部模型。原始快照和最近同步的评测可分别查看。[Artificial Analysis](https://artificialanalysis.ai/zh)

## 部署

- 用仓库链接所指分支。Node.js 24 下运行 `npm ci` 和 `npm run build`。自托管用 `npm start` 并接入 HTTPS；托管平台可读取仓库中的平台配置。
- 在服务端设置 `AA_API_KEY`、`COMPUTE_AXIS_ADMIN_PASSWORD`（随机密码，至少 24 字符）和站点 `COMPUTE_AXIS_ORIGIN`。自托管设置 `AA_STATE_FILE` 为持久化 JSON 文件的绝对路径，并用 `AA_PUBLIC_DATA=1` 开启授权的公开图表。使用平台调度时配置 `CRON_SECRET` 和私有存储，授权的初始快照放在 `compute-axis/aa-snapshot.json`。
- 核对线上提交号和三个页面，访问 `/admin/aa`（账号 `admin`）验证密码保护并手动同步。每天北京时间 03:00 调度，以托管平台实际执行记录验收。

## 数据来源

硬件参数参考 Flopper 和厂商资料，硬件选型目录参考 LocalLLM Advisor。品牌图片仅用于识别，原始出处见 [品牌资料](assets/brands/SOURCES.md)。[Flopper](https://flopper.io/gpus) · [LocalLLM Advisor](https://www.localllm-advisor.com/search/hardware)

仓库代码的许可待维护者确定。第三方名称、图标和数据沿用各自的授权条件。
