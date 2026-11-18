// Parameter counts are nominal model sizes from the linked model cards.
const ADVISOR_DATA = {
  models: [
    {name:'Qwen3.8-27B', family:'qwen', params_b:27, provider:'Qwen', hf_id:'Qwen/Qwen3.8-27B'},
    {name:'Qwen3-8B', family:'qwen', params_b:8, provider:'Qwen', hf_id:'Qwen/Qwen3-8B'},
    {name:'DeepSeek-R1-Distill-Qwen-14B', family:'deepseek', params_b:14, provider:'DeepSeek', hf_id:'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B'},
  ],
  gpus: HARDWARE,
};
