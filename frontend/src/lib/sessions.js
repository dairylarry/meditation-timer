import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

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

function pk(userId) {
  return `USER#${userId}`
}

export async function recordSession({ userId, date, completedAt, durationMinutes }) {
  if (!userId) throw new Error('recordSession requires userId')
  // Always record the hint locally — Landing uses this to decide whether to show
  // the reflect link without needing a network call.
  try { localStorage.setItem('lastSessionDate', date) } catch (_) {}
  if (isDev) {
    console.log('[dev] skipping DynamoDB write:', { userId, date, completedAt, durationMinutes })
    return
  }
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      userId: pk(userId),
      completedAt,
      date,
      durationMinutes,
    },
  }))
}

export async function updateSessionNote({ userId, completedAt, note }) {
  if (!userId || !completedAt) throw new Error('updateSessionNote requires userId and completedAt')
  if (isDev) {
    console.log('[dev] skipping DynamoDB note update:', { userId, completedAt, note })
    return
  }
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { userId: pk(userId), completedAt },
    UpdateExpression: 'SET #n = :note',
    ExpressionAttributeNames: { '#n': 'note' },
    ExpressionAttributeValues: { ':note': note },
  }))
}

export async function fetchSessions({ userId }) {
  if (!userId) throw new Error('fetchSessions requires userId')
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'userId' },
    ExpressionAttributeValues: { ':pk': pk(userId) },
  }))
  return result.Items || []
}
