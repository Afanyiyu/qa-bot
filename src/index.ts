import './env'

import { App } from 'koishi'

import * as pluginOnebot from '@koishijs/plugin-onebot'
import * as pluginCommon from '@koishijs/plugin-common'
import * as pluginMysql from '@koishijs/plugin-mysql'
import * as pluginAssets from '@koishijs/plugin-assets'

import * as pluginQa from './plugins/qa'

const app = new App({
  nickname: '问答',
  autoAuthorize: 2,
  port: process.env.KOISHI_PORT as unknown as number,
  selfUrl: process.env.KOISHI_SELF_URL,
})

// Configure onebot
app.plugin(pluginOnebot, {
  protocol: 'ws',
  selfId: process.env.ONEBOT_SELF_ID,
  endpoint: process.env.ONEBOT_WS_ENDPOINT,
})

// Configure Mysql
app.plugin(pluginMysql, {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: process.env.KOISHI_MYSQL_PASS,
  database: 'qabot',
})

app.plugin(pluginAssets, {
  type: 'local',
  root: process.env.KOISHI_ASSETS_ROOT,
})

// Configure plugin-common
app.plugin(pluginCommon)

// Configure qa
app.plugin(pluginQa)

app.start()
