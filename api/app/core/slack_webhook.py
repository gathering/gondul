import validators
from slack_sdk import WebhookClient

from app.core.config import settings
from app.models.oplog import OplogBase

client: WebhookClient
if validators.url(settings.SLACK_WEBHOOK_URI):
  client = WebhookClient(settings.SLACK_WEBHOOK_URI)

async def send_oplog_notification(oplog: OplogBase):
  if not validators.url(settings.SLACK_WEBHOOK_URI):
    return

  message = f"{oplog.time} {oplog.systems} [{oplog.username}] {oplog.message}"
  try:
    client.send(text=message)
  except Exception as e:
    print(e)
