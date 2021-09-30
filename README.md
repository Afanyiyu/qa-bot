# qa-bot

基于 plugin-teach 魔改的问答机器人，适用于客服/知识库等场景。

## 特点

- 基于 [koishi v4](https://koishi.js.org/)，魔改 [plugin-teach](https://github.com/koishijs/koishi/tree/master/plugins/teach)

- 移除了正则、重定向、概率等功能，只保留了最基础的一问一答

- 移除了上下文功能，整个机器人共享同一个问答数据库

- 移除了帮助指令和所有快捷方式，专注于问答功能

## 用法

指令|作用
-|-
`搜索 <问题>`|搜索问题。
`#<问题编号>`|查看问题。
`# <问题> <回答>`|添加问题。

## 许可

MIT
