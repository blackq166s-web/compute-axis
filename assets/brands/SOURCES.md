# 品牌图标来源

用于硬件目录的品牌识别，均本地保存，图标不跟随网页主题变色。

- nvidia.svg: https://raw.githubusercontent.com/simple-icons/simple-icons/11.15.0/icons/nvidia.svg
- amd.svg: https://raw.githubusercontent.com/simple-icons/simple-icons/11.15.0/icons/amd.svg
- apple.svg: https://raw.githubusercontent.com/simple-icons/simple-icons/11.15.0/icons/apple.svg
- huawei.svg: https://raw.githubusercontent.com/simple-icons/simple-icons/11.15.0/icons/huawei.svg
- hygon.png: https://avatars.githubusercontent.com/HYGON-AI?s=64
- cambricon.png: https://avatars.githubusercontent.com/Cambricon?s=64
- mthreads.png: https://avatars.githubusercontent.com/MooreThreads?s=64

NVIDIA、AMD、Apple、Huawei 采用 Simple Icons 标识；海光、寒武纪、摩尔线程采用对应厂商 GitHub 组织头像。图标用于品牌识别，不表示厂商背书。

## 2026-11-17 Flopper 来源库新增图标

来自 https://flopper.io/gpus 当次公开表格：Google、Microsoft、Intel 使用同页可见 SVG；其余新增图标使用下列公开图片，本地文件加 flopper- 前缀。来源记录也保存在原始输入目录，运行时不请求外部图标。

- https://flopper.io/vendors/meta.png
- https://flopper.io/vendors/openai.png
- https://flopper.io/vendors/sambanova.png
- https://flopper.io/vendors/d-matrix.png
- https://flopper.io/vendors/biren.png
- https://flopper.io/vendors/rebellions.png
- https://flopper.io/vendors/aws.png

现有 NVIDIA、AMD、Huawei、Moore Threads 等标识继续沿用。品牌代表色独立于网页蓝紫主题；新标识仅用于识别，不表示厂商背书。

## 完整目录扩展

用户选择完整 320 条后，补齐全部 29 个来源品牌的标识记录。28 个品牌采用来源页可见 SVG 或 /vendors/ 图片，本地保存；燧原在来源页使用 EF 缩写与 rgb(232,56,13) 背景，网页沿用这一标识。图标懒加载时从同页 img.src 读取实际公开地址，未猜测图片路径。

完整来源和文件名见项目输入目录 20261117_Flopper导入/完整图标来源.json、品牌缩写来源.json。已有项目图标优先沿用，不覆盖；运行时仍无需外链。

## 透明底图库

硬件表格和 AA 图表使用 [透明底图库](transparent/图库索引.md)。图库含 56 个品牌标志和 16 个暗色背景变体，统一为 128 × 128 RGBA PNG。来源、别名和校验值见 [brands.json](transparent/brands.json)。图库更新后，在网站目录运行 `node scripts/build_brand_icons.cjs` 生成浏览器映射。
