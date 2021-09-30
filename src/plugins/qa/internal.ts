import { Context, defineProperty, Query } from 'koishi'
import { Dialogue } from './utils'
import { formatQuestionAnswers } from './search'

declare module 'koishi' {
  namespace Command {
    interface Config {
      noInterp?: boolean
    }
  }
}

export default function apply(ctx: Context, config: Dialogue.Config): void {
  defineProperty(ctx.app, 'qaHistory', {})

  ctx.command('qa').check(({ options, args }) => {
    function parseArgument() {
      if (!args.length) return ''
      const [arg] = args.splice(0, 1)
      if (!arg || arg === '~' || arg === '～') return ''
      return arg.trim()
    }

    const question = parseArgument()
    const answer = parseArgument()
    if (args.length) {
      return '存在多余的参数，请检查指令语法或将含有空格或换行的问答置于一对引号内。'
    } else if (/\[CQ:(?!face)/.test(question)) {
      return '问题必须是纯文本。'
    }
    const { original, parsed, appellative } = config._stripQuestion(question)
    defineProperty(options, 'appellative', appellative)
    defineProperty(options, 'original', original)
    args[0] = parsed
    args[1] = answer
    if (!args[0] && !args[1]) args.splice(0, Infinity)
  })

  ctx.before('dialogue/modify', async (argv) => {
    const { options, dialogues, args } = argv
    const { regexp } = options
    const [question] = args

    // 检测正则表达式的合法性
    if (
      regexp ||
      (regexp !== false &&
        question &&
        dialogues.some((d) => d.flag & Dialogue.Flag.regexp))
    ) {
      const questions = question ? [question] : dialogues.map((d) => d.question)
      try {
        questions.forEach((q) => new RegExp(q))
      } catch (error) {
        return '问题含有错误的或不支持的正则表达式语法。'
      }
    }
  })

  ctx.before('dialogue/modify', async ({ options, target, args }) => {
    // 添加问答时缺少问题或回答
    if (options.create && !target) {
      if (args.length === 0)
        return `问答 v0.1.0
by Il-Harper
用法：
搜索 <问题> - 搜索问题。
#<问题编号> - 查看问题。
# <问题> <回答> - 添加问题。`
      else if (!(args[0] && args[1])) return '缺少问题或回答，请检查指令语法。'
    }
  })

  ctx.on('dialogue/modify', ({ options, args }, data) => {
    if (args[1]) {
      data.answer = args[1]
    }

    if (options.regexp !== undefined) {
      data.flag &= ~Dialogue.Flag.regexp
      data.flag |= +options.regexp * Dialogue.Flag.regexp
    }

    if (args[0]) {
      data.question = args[0]
      data.original = options.original
    }
  })

  ctx.on('dialogue/detail', async (dialogue, output, argv) => {
    if (dialogue._redirections?.length) {
      output.push(
        '重定向到：',
        ...formatQuestionAnswers(argv, dialogue._redirections)
      )
    }
  })

  ctx.on('dialogue/flag', (flag) => {
    ctx.before('dialogue/search', ({ options }, test) => {
      test[flag] = options[flag]
    })

    ctx.on('dialogue/modify', ({ options }: Dialogue.Argv, data: Dialogue) => {
      if (options[flag] !== undefined) {
        data.flag &= ~Dialogue.Flag[flag]
        data.flag |= +options[flag] * Dialogue.Flag[flag]
      }
    })

    ctx.on('dialogue/test', (test, query) => {
      if (test[flag] === undefined) return
      query.$and.push({
        flag: {
          [test[flag] ? '$bitsAllSet' : '$bitsAllClear']: Dialogue.Flag[flag],
        },
      })
    })
  })

  ctx.before('command', ({ command, session }) => {
    if (command.config.noInterp && session._redirected) {
      return `禁止在教学回答中插值调用 ${command.name} 指令。`
    }
  })

  ctx.before('dialogue/modify', async ({ args }) => {
    if (!args[1]) return
    try {
      args[1] = await ctx.transformAssets(args[1])
    } catch (error: any) {
      ctx.logger('qa').warn(error.message)
      return '上传图片时发生错误。'
    }
  })

  ctx.on('dialogue/test', ({ regexp, answer, question, original }, query) => {
    if (regexp) {
      if (answer) query.answer = { $regex: new RegExp(answer, 'i') }
      if (original) query.original = { $regex: new RegExp(original, 'i') }
      return
    }
    if (answer) query.answer = answer
    if (regexp === false) {
      if (question) query.question = question
    } else if (original) {
      const $or: Query.Expr<Dialogue>[] = [
        {
          flag: { $bitsAllSet: Dialogue.Flag.regexp },
          original: { $regexFor: original },
        },
      ]
      if (question)
        $or.push({ flag: { $bitsAllClear: Dialogue.Flag.regexp }, question })
      query.$and.push({ $or })
    }
  })
}
