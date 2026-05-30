/* eslint-env node */
const express = require('express')
const { spawn } = require('child_process')

const app = express()
app.use(express.json())

const FIGMA_PASSCODE = 'figma-demo-secret'

// CHANGE THIS
const FAKE_JIRA_PROJECT_PATH = '/Users/admin/issue-tracker'

let claudeRunning = false

async function getFileName(fileKey) {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
    headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN },
  })
  const data = await res.json()
  console.log(
    '[figma api] file name response:',
    JSON.stringify(data).slice(0, 200),
  )
  return data.name?.replace(/\s+/g, '-') || 'design'
}

async function buildFigmaNodeUrl(payload) {
  const fileKey = payload.file_key || payload.fileKey
  const nodeId = payload.node_id || payload.nodeId

  if (!fileKey) return null

  const fileName = await getFileName(fileKey)
  let url = `https://www.figma.com/design/${fileKey}/${fileName}`

  if (nodeId) {
    // Figma URLs usually use node-id=12-34 while API/webhook may give 12:34
    const figmaUrlNodeId = String(nodeId).replace(/:/g, '-')
    url += `?node-id=${figmaUrlNodeId}&m=dev`
  }

  return url
}

function runClaudeToUpdateFakeJira(newFigmaLink, payload) {
  return new Promise((resolve, reject) => {
    if (claudeRunning) {
      console.log('Claude is already running. Skipping duplicate trigger.')
      return resolve('Skipped duplicate Claude run.')
    }

    claudeRunning = true

    const prompt = `
You are working inside a fake JIRA React app at /Users/admin/issue-tracker.

Task: Replace any existing Figma link that contains file key "${payload.file_key}" with this new link:
${newFigmaLink}

Steps:
1. Run: grep -r "figma.com" /Users/admin/issue-tracker/src --include="*.jsx" --include="*.js" -l
2. Read each file found.
3. Replace the old Figma URL (the one containing "${payload.file_key}") with exactly: ${newFigmaLink}
4. Do not change anything else.
`

    console.log('Triggering Claude Code...')
    console.log('New Figma link:', newFigmaLink)

    let claudePath
    try {
      claudePath = require('child_process').execSync('which claude', { env: process.env }).toString().trim()
      console.log('[claude path]:', claudePath)
    } catch (e) {
      console.error('[claude path error]:', e.message)
      claudeRunning = false
      return reject(e)
    }

    const claude = spawn(
      claudePath,
      [
        '-p',
        prompt,
        '--allowedTools',
        'Read,Edit,Bash',
        '--permission-mode',
        'bypassPermissions',
      ],
      {
        cwd: FAKE_JIRA_PROJECT_PATH,
        env: { ...process.env },
        stdio: 'inherit',
      },
    )

    claude.on('error', (err) => {
      console.error('[claude spawn error]:', err.message)
      claudeRunning = false
    })

    claude.on('close', (code) => {
      claudeRunning = false

      if (code === 0) {
        console.log('Claude finished updating fake JIRA.')
        resolve('Claude finished.')
      } else {
        console.error(`Claude exited with code ${code}`)
        reject(new Error(`Claude exited with code ${code}`))
      }
    })
  })
}

app.post('/figma-webhook', async (req, res) => {
  console.log('Webhook received:')
  console.log(JSON.stringify(req.body, null, 2))

  if (req.body.passcode !== FIGMA_PASSCODE) {
    console.log('Invalid passcode')
    return res.status(401).send('invalid passcode')
  }

  if (req.body.event_type === 'PING') {
    console.log('Figma PING received. Webhook is working.')
    return res.status(200).send('pong')
  }

  if (
    req.body.event_type === 'DEV_MODE_STATUS_UPDATE' &&
    req.body.status === 'READY_FOR_DEV'
  ) {
    const newFigmaLink = await buildFigmaNodeUrl(req.body)

    if (!newFigmaLink) {
      console.log('Could not build Figma link from payload.')
      return res.status(400).send('missing file key')
    } // Respond to Figma immediately so webhook doesn't timeout.

    res.status(200).send('Ready for Dev received. Claude trigger started.')

    try {
      await runClaudeToUpdateFakeJira(newFigmaLink, req.body)
    } catch (err) {
      console.error('Claude update failed:', err.message)
    }

    return
  }

  res.status(200).send('ok')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Local webhook running at http://localhost:${PORT}/figma-webhook`)
})
