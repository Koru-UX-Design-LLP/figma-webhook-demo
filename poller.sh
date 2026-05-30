#!/bin/bash

SERVER="https://figma-webhook-demo.onrender.com"
PROJECT_DIR="/Users/admin/issue-tracker"

echo "Poller started. Watching for Ready for Dev events..."

while true; do
  EVENT=$(curl -s "$SERVER/next-event")

  if [ "$EVENT" != "null" ] && [ -n "$EVENT" ]; then
    FILE_KEY=$(echo "$EVENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('file_key',''))")
    NODE_ID=$(echo "$EVENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('node_id','').replace(':','-'))")
    FILE_NAME=$(echo "$EVENT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('file_name') or 'design')")

    FIGMA_URL="https://www.figma.com/design/${FILE_KEY}/${FILE_NAME}?node-id=${NODE_ID}&m=dev"

    echo "Event received! Node: $NODE_ID"
    echo "Figma URL: $FIGMA_URL"
    echo "Running Claude..."

    (cd "$PROJECT_DIR" && claude -p "You are working inside a fake JIRA React app at $PROJECT_DIR.
Task: Replace any existing Figma link that contains file key \"$FILE_KEY\" with this new link: $FIGMA_URL
Steps:
1. Run: grep -r \"figma.com\" $PROJECT_DIR/src --include=\"*.jsx\" --include=\"*.js\" -l
2. Read each file found.
3. Replace the old Figma URL with exactly: $FIGMA_URL
4. Do not change anything else." \
      --allowedTools "Read,Edit,Bash" \
      --permission-mode bypassPermissions)

    echo "Claude done."
  fi

  sleep 5
done
