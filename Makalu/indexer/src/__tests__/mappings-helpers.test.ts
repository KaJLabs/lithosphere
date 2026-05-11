import { describe, expect, it } from 'vitest';
import {
  attr,
  attrTuples,
  decodeTransferLog,
  parseIntSafe,
  topicToAddress,
  toIsoString,
  tryBase64,
  type TxEvent,
} from '../mappings.js';

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const LEP100_TRANSFER_SINGLE_TOPIC =
  '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

describe('tryBase64', () => {
  it('decodes a genuine base64 string', () => {
    expect(tryBase64('aGVsbG8=')).toBe('hello');
  });

  it('returns null for plain text that happens to share characters with base64', () => {
    expect(tryBase64('not-base64-text')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(tryBase64('')).toBeNull();
  });

  it('returns null when the decoded bytes contain invalid UTF-8', () => {
    const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]).toString('base64');
    expect(tryBase64(invalidUtf8)).toBeNull();
  });

  it('round-trip validates: rejects inputs that do not survive re-encoding', () => {
    // 'transfer' looks decodable but does not round-trip to itself
    expect(tryBase64('transfer')).toBeNull();
  });
});

describe('attr', () => {
  const plainEvents: TxEvent[] = [
    {
      type: 'transfer',
      attributes: [
        { key: 'sender', value: 'litho1aaa' },
        { key: 'recipient', value: 'litho1bbb' },
        { key: 'amount', value: '1000ulitho' },
      ],
    },
  ];

  const base64Events: TxEvent[] = [
    {
      type: 'transfer',
      attributes: [
        { key: Buffer.from('sender').toString('base64'), value: Buffer.from('litho1ccc').toString('base64') },
        { key: Buffer.from('amount').toString('base64'), value: Buffer.from('500ulitho').toString('base64') },
      ],
    },
  ];

  it('returns the value of a plain-text attribute', () => {
    expect(attr(plainEvents, 'transfer', 'sender')).toBe('litho1aaa');
  });

  it('returns the value of a base64-encoded attribute and decodes both key and value', () => {
    expect(attr(base64Events, 'transfer', 'sender')).toBe('litho1ccc');
  });

  it('returns empty string when the event type does not match', () => {
    expect(attr(plainEvents, 'message', 'sender')).toBe('');
  });

  it('returns empty string when the key is not present', () => {
    expect(attr(plainEvents, 'transfer', 'missing')).toBe('');
  });

  it('returns the first matching value when the same key appears in multiple events', () => {
    const events: TxEvent[] = [
      { type: 'transfer', attributes: [{ key: 'sender', value: 'first' }] },
      { type: 'transfer', attributes: [{ key: 'sender', value: 'second' }] },
    ];
    expect(attr(events, 'transfer', 'sender')).toBe('first');
  });
});

describe('attrTuples', () => {
  it('collects requested keys from each event of the matching type', () => {
    const events: TxEvent[] = [
      {
        type: 'coin_received',
        attributes: [
          { key: 'receiver', value: 'litho1aaa' },
          { key: 'amount', value: '100ulitho' },
        ],
      },
      {
        type: 'coin_received',
        attributes: [
          { key: 'receiver', value: 'litho1bbb' },
          { key: 'amount', value: '200ulitho' },
        ],
      },
      {
        type: 'transfer',
        attributes: [{ key: 'sender', value: 'litho1ccc' }],
      },
    ];

    expect(attrTuples(events, 'coin_received', ['receiver', 'amount'])).toEqual([
      { receiver: 'litho1aaa', amount: '100ulitho' },
      { receiver: 'litho1bbb', amount: '200ulitho' },
    ]);
  });

  it('skips events that contain none of the requested keys', () => {
    const events: TxEvent[] = [
      {
        type: 'tx',
        attributes: [{ key: 'unrelated', value: 'noise' }],
      },
    ];
    expect(attrTuples(events, 'tx', ['fee'])).toEqual([]);
  });

  it('handles base64-encoded attributes for both key and value', () => {
    const events: TxEvent[] = [
      {
        type: 'coin_received',
        attributes: [
          { key: Buffer.from('receiver').toString('base64'), value: Buffer.from('litho1abc').toString('base64') },
          { key: Buffer.from('amount').toString('base64'), value: Buffer.from('42ulitho').toString('base64') },
        ],
      },
    ];
    expect(attrTuples(events, 'coin_received', ['receiver', 'amount'])).toEqual([
      { receiver: 'litho1abc', amount: '42ulitho' },
    ]);
  });
});

describe('parseIntSafe', () => {
  it('returns the number unchanged when given a number', () => {
    expect(parseIntSafe(42)).toBe(42);
  });

  it('parses numeric strings', () => {
    expect(parseIntSafe('123')).toBe(123);
  });

  it('returns 0 for null, undefined, and empty input', () => {
    expect(parseIntSafe(null)).toBe(0);
    expect(parseIntSafe(undefined)).toBe(0);
    expect(parseIntSafe('')).toBe(0);
  });

  it('returns 0 for un-parseable strings', () => {
    expect(parseIntSafe('not-a-number')).toBe(0);
  });

  it('truncates floats parsed from string', () => {
    expect(parseIntSafe('3.9')).toBe(3);
  });
});

describe('toIsoString', () => {
  it('formats a Date object as ISO 8601', () => {
    expect(toIsoString(new Date('2026-05-11T12:00:00.000Z'))).toBe('2026-05-11T12:00:00.000Z');
  });

  it('parses a date string and re-emits ISO 8601', () => {
    expect(toIsoString('2026-05-11T12:00:00Z')).toBe('2026-05-11T12:00:00.000Z');
  });

  it('returns null for invalid date strings', () => {
    expect(toIsoString('not-a-date')).toBeNull();
  });

  it('returns null for empty / nullish input', () => {
    expect(toIsoString(null)).toBeNull();
    expect(toIsoString(undefined)).toBeNull();
    expect(toIsoString('')).toBeNull();
  });
});

describe('topicToAddress', () => {
  it('extracts the last 20 bytes of a 32-byte indexed topic as a lowercase 0x address', () => {
    const topic = '0x00000000000000000000000022d279d24f0b7ca5d49c5a7a7f032da416f72387';
    expect(topicToAddress(topic)).toBe('0x22d279d24f0b7ca5d49c5a7a7f032da416f72387');
  });

  it('lowercases mixed-case topics', () => {
    const topic = '0x00000000000000000000000022D279D24F0B7CA5D49C5A7A7F032DA416F72387';
    expect(topicToAddress(topic)).toBe('0x22d279d24f0b7ca5d49c5a7a7f032da416f72387');
  });

  it('returns null for short or missing topics', () => {
    expect(topicToAddress(undefined)).toBeNull();
    expect(topicToAddress('')).toBeNull();
    expect(topicToAddress('0x123')).toBeNull();
  });
});

describe('decodeTransferLog', () => {
  it('decodes an ERC20 Transfer (3 topics, value in data)', () => {
    const log = {
      topics: [
        ERC20_TRANSFER_TOPIC,
        '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ],
      // 1000 in hex = 0x3e8, padded to 32 bytes
      data: '0x00000000000000000000000000000000000000000000000000000000000003e8',
    };
    expect(decodeTransferLog(log)).toEqual({
      from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      value: '1000',
      tokenId: null,
    });
  });

  it('decodes an ERC721 Transfer (4 topics, tokenId in topics[3])', () => {
    const log = {
      topics: [
        ERC20_TRANSFER_TOPIC,
        '0x000000000000000000000000cccccccccccccccccccccccccccccccccccccccc',
        '0x000000000000000000000000dddddddddddddddddddddddddddddddddddddddd',
        '0x000000000000000000000000000000000000000000000000000000000000002a',
      ],
      data: '0x',
    };
    expect(decodeTransferLog(log)).toEqual({
      from: '0xcccccccccccccccccccccccccccccccccccccccc',
      to: '0xdddddddddddddddddddddddddddddddddddddddd',
      value: '0',
      tokenId: '42',
    });
  });

  it('decodes a LEP100 TransferSingle (4 topics, id+value packed in data)', () => {
    const log = {
      topics: [
        LEP100_TRANSFER_SINGLE_TOPIC,
        // operator (ignored by decoder)
        '0x000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        // from
        '0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff',
        // to
        '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ],
      // id = 0, value = 0x3e8 (1000)
      data:
        '0x0000000000000000000000000000000000000000000000000000000000000000' +
        '00000000000000000000000000000000000000000000000000000000000003e8',
    };
    expect(decodeTransferLog(log)).toEqual({
      from: '0xffffffffffffffffffffffffffffffffffffffff',
      to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      value: '1000',
      tokenId: null,
    });
  });

  it('returns null for an unknown topic[0]', () => {
    const log = {
      topics: ['0x' + '0'.repeat(64)],
      data: '0x',
    };
    expect(decodeTransferLog(log)).toBeNull();
  });

  it('returns null when an ERC20 log is malformed (wrong topic count)', () => {
    const log = {
      topics: [ERC20_TRANSFER_TOPIC, '0x' + '0'.repeat(64)],
      data: '0x' + '0'.repeat(64),
    };
    expect(decodeTransferLog(log)).toBeNull();
  });

  it('returns null when a LEP100 log has insufficient data', () => {
    const log = {
      topics: [
        LEP100_TRANSFER_SINGLE_TOPIC,
        '0x' + '0'.repeat(64),
        '0x' + '0'.repeat(64),
        '0x' + '0'.repeat(64),
      ],
      data: '0x', // missing id + value
    };
    expect(decodeTransferLog(log)).toBeNull();
  });
});
