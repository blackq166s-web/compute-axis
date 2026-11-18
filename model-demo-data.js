// Fictional figures for demonstrating charts. They describe no real model or benchmark.
const MODEL_DEMO_DATA = {
  domains: ['写作', '数学', '代码', '阅读', '工具使用', '逻辑'],
  models: [
    {id:'sample-a', name:'示例 A', maker:'演示组', color:'#8a79fa', weight:true, score:72,
      cost:1.2, minutes:2.4, tokens:8200, capabilityScores:[69,70,84,62,70,77]},
    {id:'sample-b', name:'示例 B', maker:'演示组', color:'#2ab69f', weight:true, score:59,
      cost:0.48, minutes:1.6, tokens:5400, capabilityScores:[52,76,49,73,45,55]},
    {id:'sample-c', name:'示例 C', maker:'演示组', color:'#4b9cf2', weight:true, score:46,
      cost:0.19, minutes:1.1, tokens:4100, capabilityScores:[62,43,51,45,50,49]},
    {id:'sample-d', name:'示例 D', maker:'演示组', color:'#e69b48', weight:false, score:85,
      cost:2.8, minutes:3.2, tokens:11700, capabilityScores:[92,85,72,86,97,89]},
  ],
};
