import './env'

import { App } from 'koishi'

import * as pluginOnebot from '@koishijs/plugin-onebot'
import * as pluginCommon from '@koishijs/plugin-common'

const app = new App()

// Configure onebot
app.plugin(pluginOnebot, {
  protocol: 'ws',
  selfId: process.env.ONEBOT_SELF_ID,
  endpoint: process.env.ONEBOT_WS_ENDPOINT,
})

// Configure plugin-common
app.plugin(pluginCommon)

app.start()
