import './env'

import { App } from 'koishi'

import * as pluginOnebot from '@koishijs/plugin-onebot'

const app = new App()

// Configure onebot
app.plugin(pluginOnebot, {
  protocol: 'ws',
  selfId: process.env.ONEBOT_SELF_ID,
  endpoint: process.env.ONEBOT_WS_ENDPOINT,
})

app.start()
