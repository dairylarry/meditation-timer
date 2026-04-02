import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
})

const docClient = DynamoDBDocumentClient.from(client)

const TABLE = 'meditation-sessions-db'

const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1'

export async function recordSession({ date, completedAt, durationMinutes }) {
  if (isDev) {
    console.log('[dev] skipping DynamoDB write:', { date, completedAt, durationMinutes })
    return
  }
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: { date, completedAt, durationMinutes },
  }))
}

export async function fetchSessions() {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE,
  }))
  return result.Items || []
}
