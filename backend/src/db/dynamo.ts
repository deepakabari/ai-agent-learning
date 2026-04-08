import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

/**
 * DynamoDB client for conversation history storage.
 *
 * Uses the perpetual free tier (25GB storage, 25 WCU, 25 RCU).
 * Each message is stored as a separate item with TTL for auto-cleanup.
 */

/** A single conversation message record. */
export interface ConversationMessage {
  sessionId: string;
  timestamp: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
  /** TTL in epoch seconds — DynamoDB auto-deletes expired items. */
  ttl: number;
}

/** Default TTL: 30 days in seconds. */
const DEFAULT_TTL_DAYS = 30;

/**
 * Creates a DynamoDB document client for the specified region.
 */
export function createDynamoClient(region: string): DynamoDBDocumentClient {
  const baseClient = new DynamoDBClient({ region });
  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });
}

/**
 * Ensure the conversations table exists (creates it if not).
 * Safe to call on every startup — no-ops if table already exists.
 */
export async function ensureTable(
  client: DynamoDBDocumentClient,
  tableName: string
): Promise<void> {
  // @ts-expect-error - Accessing underlying client for DescribeTableCommand
  const baseClient = client.config?.client as DynamoDBClient;

  try {
    await baseClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    return; // Table exists
  } catch (error: unknown) {
    if (error instanceof Error && error.name !== "ResourceNotFoundException") {
      throw error;
    }
  }

  // Create table with provisioned capacity (free tier: 25 WCU/RCU)
  await baseClient.send(
    new CreateTableCommand({
      TableName: tableName,
      KeySchema: [
        { AttributeName: "sessionId", KeyType: "HASH" },
        { AttributeName: "timestamp", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "sessionId", AttributeType: "S" },
        { AttributeName: "timestamp", AttributeType: "S" },
      ],
      BillingMode: "PROVISIONED",
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    })
  );

  console.log(`[DynamoDB] Created table "${tableName}"`);
}

/**
 * Save a conversation message to DynamoDB.
 */
export async function saveMessage(
  client: DynamoDBDocumentClient,
  tableName: string,
  message: Omit<ConversationMessage, "ttl">
): Promise<void> {
  const ttl =
    Math.floor(Date.now() / 1000) + DEFAULT_TTL_DAYS * 24 * 60 * 60;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: { ...message, ttl },
    })
  );
}

/**
 * Retrieve conversation history for a session,
 * ordered chronologically by timestamp.
 */
export async function getConversationHistory(
  client: DynamoDBDocumentClient,
  tableName: string,
  sessionId: string,
  limit = 50
): Promise<ConversationMessage[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "sessionId = :sid",
      ExpressionAttributeValues: { ":sid": sessionId },
      ScanIndexForward: true, // Chronological order
      Limit: limit,
    })
  );

  return (result.Items as ConversationMessage[]) ?? [];
}
