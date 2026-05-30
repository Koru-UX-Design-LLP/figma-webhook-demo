/* eslint-env node */
const express = require('express')

const app = express()
app.use(express.json())

const FIGMA_PASSCODE = 'figma-demo-secret'

const eventQueue = []

async function getFileName(fileKey) {
  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
      headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN },
    })
    const data = await res.json()
    return data.name?.replace(/\s+/g, '-') || null
  } catch {
    return null
  }
}

app.post('/figma-webhook', async (req, res) => {
  console.log('Webhook received:', req.body.event_type, req.body.status)

  if (req.body.passcode !== FIGMA_PASSCODE) {
    return res.status(401).send('invalid passcode')
  }

  if (req.body.event_type === 'PING') {
    console.log('PING received.')
    return res.status(200).send('pong')
  }

  if (req.body.event_type === 'DEV_MODE_STATUS_UPDATE' && req.body.status === 'READY_FOR_DEV') {
    res.status(200).send('ok')
    const fileName = await getFileName(req.body.file_key)
    eventQueue.push({ ...req.body, file_name: fileName })
    console.log('Event queued. File name:', fileName, 'Queue length:', eventQueue.length)
    return
  }

  res.status(200).send('ok')
})

app.get('/next-event', (req, res) => {
  const event = eventQueue.shift()
  if (!event) return res.json(null)
  console.log('Event dispatched to poller:', event.node_id)
  res.json(event)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
