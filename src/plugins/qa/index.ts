import { Argv, Context, escapeRegExp, merge } from 'koishi'
import { Dialogue } from './utils'
import internal from './internal'
import receiver from './receiver'
import search from './search'
import update, { create } from './update'
import throttle from './plugins/throttle'
import writer from './plugins/writer'

export * from './utils'
export * from './receiver'
export * from './search'
export * from './update'
export * from './plugins/throttle'
export * from './plugins/writer'

export type Config = Dialogue.Config

declare module 'koishi' {
  interface EventMap {
    'dialogue/validate'(argv: Dialogue.Argv): void | string
    'dialogue/execute'(argv: Dialogue.Argv): void | Promise<void | string>
  }
}

export const name = 'qa'

function registerPrefix(ctx: Context, prefix: string) {
  const g = '\\d+(?:\\.\\.\\d+)?'
  const last = prefix[prefix.length - 1]
  const p = escapeRegExp(prefix)
  const l = escapeRegExp(last)
  const qaRegExp = new RegExp(`^${p}(${l}?)((${g}(?:,${g})*)?|${l}?)$`)
  //                                   $1     $2

  ctx.on('parse', (argv, session) => {
    if ((argv.root && session.quote) || !argv.tokens.length) return
    let { content } = argv.tokens[0]
    if (argv.root && session.parsed.prefix) {
      content = session.parsed.prefix + content
    }
    const capture = qaRegExp.exec(content)
    if (!capture) return

    argv.tokens.shift()
    argv.tokens.forEach(Argv.revert)
    argv.source = session.parsed.content
    argv.options = {}
    const { length } = argv.tokens
    if (capture[1] === last) {
      if (!argv.tokens.length) return 'qa.status'
      argv.options['search'] = true
    } else if (!capture[2] && !length) {
      // argv.options['help'] = true
    }

    if (capture[2] && capture[2] !== last) {
      argv.options['target'] = capture[2]
    }

    return 'qa'
  })

  ctx.on('parse', (argv, session) => {
    if ((argv.root && session.quote) || !argv.tokens.length) return
    const { content } = argv.tokens[0]
    if (content !== '搜索') return

    argv.tokens.shift()
    argv.tokens.forEach(Argv.revert)
    argv.source = session.parsed.content
    argv.options = {}
    if (!argv.tokens.length) return 'qa.status'
    argv.options['search'] = true
    argv.options['searchQuestionAnswer'] = true

    return 'qa'
  })
}

export function apply(ctx: Context, config: Config = {}): void {
  config = merge(config, {
    prefix: '#',
    authority: {
      base: 2,
      admin: 3,
      context: 3,
      frozen: 4,
      regExp: 3,
      writer: 2,
      receive: 1,
    },
  })

  registerPrefix(ctx, config.prefix)

  ctx
    .command('qa', '查询问答', {
      authority: config.authority.base,
      checkUnknown: true,
      hideOptions: true,
    })
    .userFields(['authority', 'id'])
    // .usage((session) => cheatSheet(session, config))
    .action(async (argv) => {
      const { options, session, args } = argv
      const argd: Dialogue.Argv = {
        app: ctx.app,
        session,
        args,
        config,
        options,
      }
      return (
        ctx.bail('dialogue/validate', argd) ||
        ctx.bail('dialogue/execute', argd) ||
        create(argd)
      )
    })

  // features
  ctx.plugin(receiver, config)
  ctx.plugin(search, config)
  ctx.plugin(update, config)

  // options
  ctx.plugin(internal, config)
  ctx.plugin(throttle, config)
  ctx.plugin(writer, config)
}
