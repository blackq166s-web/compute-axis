// Small, independently sourced specification catalog for this demo.
const HARDWARE_SOURCE_DATE = '2026-11-18';
const HARDWARE = [
  {
    id:'4060', name:'RTX 4060', brand:'NVIDIA', tier:'consumer', type:'card',
    architecture:'Ada Lovelace', memory:8, bandwidth:null, tdp:115,
    source:'https://www.nvidia.com/en-eu/geforce/graphics-cards/40-series/rtx-4060-4060ti/',
  },
  {
    id:'4090', name:'RTX 4090', brand:'NVIDIA', tier:'consumer', type:'card',
    architecture:'Ada Lovelace', memory:24, bandwidth:1008,
    source:'https://images.nvidia.com/aem-dam/Solutions/geforce/ada/nvidia-ada-gpu-architecture.pdf',
  },
  {
    id:'5090', name:'RTX 5090', brand:'NVIDIA', tier:'consumer', type:'card',
    architecture:'Blackwell', memory:32, bandwidth:1792,
    source:'https://images.nvidia.com/aem-dam/Solutions/geforce/blackwell/nvidia-rtx-blackwell-gpu-architecture.pdf',
  },
  {
    id:'9070xt', name:'Radeon RX 9070 XT', brand:'AMD', tier:'consumer', type:'card',
    architecture:'RDNA 4', memory:16, bandwidth:640,
    source:'https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070xt.html',
  },
  {
    id:'p6000', name:'RTX PRO 6000 Blackwell 工作站版', brand:'NVIDIA', tier:'workstation', type:'card',
    architecture:'Blackwell', memory:96, bandwidth:1792, tdp:600,
    source:'https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/',
  },
  {
    id:'h200', name:'H200 SXM', brand:'NVIDIA', tier:'enterprise', type:'card',
    architecture:'Hopper', memory:141, bandwidth:4800, tdp:700, fp8:3958, fp16:1979,
    source:'https://www.nvidia.com/en-us/data-center/h200/',
    sourceNotes:['FP8 和 FP16 为厂商公布的稀疏 Tensor Core 峰值，TDP 为可配置上限。'],
  },
  {
    id:'spark', name:'DGX Spark (GB10)', brand:'NVIDIA', tier:'workstation', type:'system',
    architecture:'Grace Blackwell', memory:128, bandwidth:273,
    source:'https://docs.nvidia.com/dgx/dgx-spark/hardware.html',
  },
  {
    id:'studio', name:'Mac Studio · M5 Max', brand:'Apple', tier:'workstation', type:'system',
    architecture:'M5 Max', memory:128, bandwidth:614,
    source:'https://www.apple.com/mac-studio/specs/',
    sourceNotes:['示例为 40 核 GPU、128 GB 统一内存配置。'],
  },
];
