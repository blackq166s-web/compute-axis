# AI Deploy Advisor · AI 部署选型

对比显存和内存带宽，按模型及量化精度估算本地部署所需的硬件。

- **硬件对比**支持搜索、分类筛选、显存和带宽图表，以及可排序的规格表。型号详情提供厂商来源。
- **硬件选型**默认使用 Qwen3.8-27B。切换 Q4、Q6、Q8 或 FP16 可查看对应的容量估算和候选配置。
- **模型对比**用虚构数据演示综合评分、任务开销、评分与成本、分领域排名。正式评测可查看 [Artificial Analysis](https://artificialanalysis.ai/zh)。

## 本地运行

可以直接打开 `index.html`，也可以用 Python 3 启动本机 HTTP 预览。

```sh
git clone https://github.com/blackq166s-web/ai-deploy-advisor.git
cd ai-deploy-advisor
python -m http.server 8000 --bind 127.0.0.1
```

打开 [http://127.0.0.1:8000](http://127.0.0.1:8000/)。网站使用原生 HTML、CSS 和 JavaScript，浏览器直接加载随仓库提供的数据。

## 目录结构

| 路径 | 用途 |
| --- | --- |
| `index.html`、`advisor.html`、`models.html` | 三个页面入口 |
| `pages/` | 硬件图表、筛选、选型和模型对比 |
| `app.js`、`theme.js`、`brand-ui.js`、`style.css` | 导航、主题、文字标识和通用样式 |
| `data.js` | 八项硬件示例及逐项厂商链接 |
| `advisor-data.js` | 三项模型元数据，复用同一份硬件规格 |
| `model-demo-data.js` | 虚构评测数据，用于演示图表和筛选 |

## 数据和估算

- 硬件示例取自 [NVIDIA](https://www.nvidia.com/en-us/data-center/h200/)、[AMD](https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html) 和 [Apple](https://www.apple.com/mac-studio/specs/) 的产品规格。统一内存总量与独显显存分别标注。空白字段表示示例目录暂无数据。
- 模型参数量取自 [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B)、[Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B) 和 [DeepSeek-R1-Distill-Qwen-14B](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-14B) 的厂商模型卡。
- 容量估算按参数量乘以每参数位数再除以 8，另加 15% 余量。统一内存和多卡容量分别按标称总量的 75% 和 95% 粗筛。生成速度用单设备带宽除以权重大小，表示仅考虑带宽时的理论上限。实际部署需核对上下文、推理框架、驱动以及多卡互联。
- 选型交互参考 [LocalLLM Advisor](https://www.localllm-advisor.com/search/hardware)。本版本只使用此处列出的示例数据。
- [Artificial Analysis Free API](https://artificialanalysis.ai/data-api) 的数据供内部使用。本版本的模型图表使用虚构数值，正式数据及分发权限以提供方条款为准。

## 许可

本仓库的代码许可待维护者确定。第三方名称和资料按各自的权利和条款使用。
