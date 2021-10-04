import { Dialogue, DialogueTest } from './utils'
import { Context, Dict } from 'koishi'

export interface SearchDetails extends Array<string> {
  questionType?: string
  answerType?: string
}

declare module 'koishi' {
  interface EventMap {
    'dialogue/list'(
      dialogue: Dialogue,
      output: string[],
      prefix: string,
      argv: Dialogue.Argv
    ): void
    'dialogue/detail-short'(
      dialogue: Dialogue,
      output: SearchDetails,
      argv: Dialogue.Argv
    ): void
    'dialogue/before-search'(
      argv: Dialogue.Argv,
      test: DialogueTest
    ): void | boolean
    'dialogue/search'(
      argv: Dialogue.Argv,
      test: DialogueTest,
      dialogue: Dialogue[]
    ): Promise<void>
  }
}

declare module './utils' {
  interface Dialogue {
    _redirections: Dialogue[]
  }

  namespace Dialogue {
    interface Argv {
      questionMap?: Dict<Dialogue[]>
    }
  }
}

export default function apply(ctx: Context): void {
  ctx.command('qa.status').action(async () => {
    const { questions, dialogues } = await Dialogue.stats(ctx)
    return `共收录了 ${questions} 个问题和 ${dialogues} 个回答。`
  })

  ctx
    .command('qa')
    .option('search', '搜索已有问答', { notUsage: true })
    .option('searchQuestionAnswer', 'INTERNAL', { notUsage: true })

  ctx.on('dialogue/execute', (argv) => {
    const { search } = argv.options
    if (search) return showSearch(argv)
  })

  ctx.on('dialogue/list', ({ _redirections }, output, prefix, argv) => {
    if (!_redirections) return
    output.push(...formatAnswers(argv, _redirections, prefix + '= '))
  })

  ctx.on('dialogue/detail-short', ({ flag }, output) => {
    if (flag & Dialogue.Flag.regexp) {
      output.questionType = '正则'
    }
  })

  ctx.on('dialogue/search', async (argv, test, dialogues) => {
    if (!argv.questionMap) {
      argv.questionMap = { [test.question]: dialogues }
    }
    for (const dialogue of dialogues) {
      const { answer } = dialogue
      // TODO extract dialogue command
      if (!answer.startsWith('%{dialogue ')) continue
      const { original, parsed } = argv.config._stripQuestion(
        answer.slice(11, -1).trimStart()
      )
      if (parsed in argv.questionMap) continue
      // TODO multiple tests in one query
      const dialogues = (argv.questionMap[parsed] = await Dialogue.get(ctx, {
        ...test,
        question: parsed,
        original: original,
      }))
      Object.defineProperty(dialogue, '_redirections', {
        writable: true,
        value: dialogues,
      })
      await argv.app.parallel('dialogue/search', argv, test, dialogues)
    }
  })
}

export function formatAnswer(source: string): string {
  const maxAnswerLength = 100
  let trimmed = false
  const lines = source.split(/(\r?\n|\$n)/g)
  if (lines.length > 1) {
    trimmed = true
    source = lines[0].trim()
  }
  source = source.replace(/\[CQ:image,[^\]]+\]/g, '[图片]')
  if (source.length > maxAnswerLength) {
    trimmed = true
    source = source.slice(0, maxAnswerLength)
  }
  if (trimmed && !source.endsWith('……')) {
    if (source.endsWith('…')) {
      source += '…'
    } else {
      source += '……'
    }
  }
  return source
}

export function getDetails(
  argv: Dialogue.Argv,
  dialogue: Dialogue
): SearchDetails {
  const details: SearchDetails = []
  argv.app.emit('dialogue/detail-short', dialogue, details, argv)
  return details
}

export function formatDetails(
  dialogue: Dialogue,
  details: SearchDetails
): string {
  return `${dialogue.id}. ${details.length ? `[${details.join(', ')}] ` : ''}`
}

function formatPrefix(
  argv: Dialogue.Argv,
  dialogue: Dialogue,
  showAnswerType = false
) {
  const details = getDetails(argv, dialogue)
  let result = formatDetails(dialogue, details)
  if (details.questionType) result += `[${details.questionType}] `
  if (showAnswerType && details.answerType) result += `[${details.answerType}] `
  return result
}

export function formatAnswers(
  argv: Dialogue.Argv,
  dialogues: Dialogue[],
  prefix = ''
): string[] {
  return dialogues.map((dialogue) => {
    const { answer } = dialogue
    const output = [
      `${prefix}${formatPrefix(argv, dialogue, true)}${formatAnswer(answer)}`,
    ]
    argv.app.emit('dialogue/list', dialogue, output, prefix, argv)
    return output.join('\n')
  })
}

export function formatQuestionAnswers(
  argv: Dialogue.Argv,
  dialogues: Dialogue[],
  prefix = ''
): string[] {
  return dialogues.map((dialogue) => {
    const details = getDetails(argv, dialogue)
    const { questionType = '问题', answerType = '回答' } = details
    const { original, answer } = dialogue
    const output = [
      `${prefix}${formatDetails(
        dialogue,
        details
      )}${questionType}：${original}，${answerType}：${formatAnswer(answer)}`,
    ]
    argv.app.emit('dialogue/list', dialogue, output, prefix, argv)
    return output.join('\n')
  })
}

async function showSearch(argv: Dialogue.Argv) {
  const {
    app,
    options,
    args: [question, answer],
  } = argv
  const { original } = options

  const test: DialogueTest = { question, answer, original, regexp: true }
  if (options['searchQuestionAnswer']) test.searchQuestionAnswer = true
  const dialogues = await Dialogue.get(app, test)

  if (!original && !answer) {
    if (!dialogues.length) return '没有搜索到任何回答，尝试切换到其他环境。'
    return sendResult('全部问答如下', formatQuestionAnswers(argv, dialogues))
  }

  const output: string[] = formatQuestionAnswers(argv, dialogues)

  if (!original) {
    if (!dialogues.length) return `没有搜索到含有“${answer}”的回答。`
    return sendResult(`回答“${answer}”的搜索结果如下`, output)
  } else if (!answer) {
    if (!dialogues.length) return `没有搜索到含有“${original}”的问题。`
    return sendResult(`问题“${original}”的搜索结果如下`, output)
  } else {
    if (!dialogues.length)
      return `没有搜索到含有“${original}”“${answer}”的问答。`
    return sendResult(`问答“${original}”“${answer}”的搜索结果如下`, output)
  }

  function sendResult(title: string, output: string[]) {
    output.unshift(title + '：')
    return output.join('\n')
  }
}
