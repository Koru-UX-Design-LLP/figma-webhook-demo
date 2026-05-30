/* eslint-env node */
const express = require('express')

const app = express()
app.use(express.json())

const FIGMA_PASSCODE = 'figma-demo-secret'

const eventQueue = []

app.post('/figma-webhook', (req, res) => {
  console.log('Webhook received:', req.body.event_type, req.body.status)

  if (req.body.passcode !== FIGMA_PASSCODE) {
    return res.status(401).send('invalid passcode')
  }

  if (req.body.event_type === 'PING') {
    console.log('PING received.')
    return res.status(200).send('pong')
  }

  if (req.body.event_type === 'DEV_MODE_STATUS_UPDATE' && req.body.status === 'READY_FOR_DEV') {
    eventQueue.push(req.body)
    console.log('Event queued. Queue length:', eventQueue.length)
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
