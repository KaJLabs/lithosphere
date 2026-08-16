import { DescribeTableCommand, DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const DECISION_KEY = /^[1-9][0-9]*:[1-9][0-9]*$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

const validateDecision = (key, hash) => {
  if (!DECISION_KEY.test(key) || !HASH.test(hash)) {
    throw new Error('invalid signing journal decision');
  }
};

export const createDynamoDecisionJournal = ({
  tableName,
  signerAddress,
  region,
  client = new DynamoDBClient({ region: region || process.env.AWS_REGION || 'us-east-1' }),
}) => {
  if (!tableName) throw new Error('SIGNER_DYNAMODB_TABLE is required');
  if (!signerAddress) throw new Error('signer address is required for DynamoDB journal');

  return {
    async assertReady() {
      const response = await client.send(new DescribeTableCommand({ TableName: tableName }));
      if (response.Table?.TableStatus !== 'ACTIVE') throw new Error('signing journal table is not ACTIVE');
      const hashKey = response.Table?.KeySchema?.find((item) => item.KeyType === 'HASH')?.AttributeName;
      if (hashKey !== 'decisionKey') throw new Error('signing journal table partition key must be decisionKey');
    },

    async record(key, hash) {
      validateDecision(key, hash);
      try {
        await client.send(new PutItemCommand({
          TableName: tableName,
          Item: {
            decisionKey: { S: key },
            hash: { S: hash.toLowerCase() },
            signerAddress: { S: signerAddress },
            recordedAt: { S: new Date().toISOString() },
          },
          ConditionExpression: 'attribute_not_exists(decisionKey) OR #decisionHash = :decisionHash',
          ExpressionAttributeNames: { '#decisionHash': 'hash' },
          ExpressionAttributeValues: { ':decisionHash': { S: hash.toLowerCase() } },
        }));
        return true;
      } catch (error) {
        if (error?.name === 'ConditionalCheckFailedException') {
          throw new Error(`refusing equivocation for ${key}`);
        }
        throw error;
      }
    },
  };
};
