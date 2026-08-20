import assert from 'node:assert/strict';
import test from 'node:test';
import { DescribeTableCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { createDynamoDecisionJournal } from '../src/dynamoJournal.js';

const address = '0x1111111111111111111111111111111111111111';
const hash = `0x${'22'.repeat(32)}`;
const key = `9005:${address}:7`;

test('checks the table schema and atomically records a decision', async () => {
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command);
      if (command instanceof DescribeTableCommand) {
        return { Table: { TableStatus: 'ACTIVE', KeySchema: [{ AttributeName: 'decisionKey', KeyType: 'HASH' }] } };
      }
      return {};
    },
  };
  const journal = createDynamoDecisionJournal({ tableName: 'decisions', signerAddress: address, client });
  await journal.assertReady();
  await journal.record(key, hash);

  assert.equal(commands.length, 2);
  assert.equal(commands[1] instanceof PutItemCommand, true);
  assert.equal(commands[1].input.Item.decisionKey.S, key);
  assert.equal(commands[1].input.Item.hash.S, hash);
  assert.match(commands[1].input.ConditionExpression, /attribute_not_exists/);
});

test('fails closed on a conditional equivocation conflict', async () => {
  const client = { async send() { throw Object.assign(new Error('conflict'), { name: 'ConditionalCheckFailedException' }); } };
  const journal = createDynamoDecisionJournal({ tableName: 'decisions', signerAddress: address, client });
  await assert.rejects(() => journal.record(key, hash), /refusing equivocation/);
});

test('rejects malformed decisions before calling DynamoDB', async () => {
  let called = false;
  const client = { async send() { called = true; } };
  const journal = createDynamoDecisionJournal({ tableName: 'decisions', signerAddress: address, client });
  await assert.rejects(() => journal.record('bad', hash), /invalid signing journal decision/);
  assert.equal(called, false);
});
