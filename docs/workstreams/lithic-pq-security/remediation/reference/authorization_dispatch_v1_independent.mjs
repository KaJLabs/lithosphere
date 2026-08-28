// Independently authored JavaScript verifier for the immutable authorization
// dispatcher defined by the Phase 0 R8 normative action registry.
import assert from 'node:assert/strict';

const ACTIONS = Object.freeze([
  [0x0001, 1, 0x0004, 0x0002, 'ordinary', 1, 'principal'],
  [0x0001, 2, 0x0005, 0x0003, 'ordinary', 1, 'principal'],
  [0x0001, 3, 0x001d, 0x0017, 'fee-payer-ordinary', 1, 'principal'],
  [0x0002, 1, 0x0010, 0x0004, 'ordinary+proposed', null, 'operation'],
  [0x0002, 2, 0x0011, 0x0005, 'ordinary+proposed', null, 'operation'],
  [0x0002, 3, 0x0012, 0x0006, 'ordinary-or-recovery', null, 'operation'],
  [0x0002, 4, 0x0013, 0x0007, 'recovery', null, 'operation'],
  [0x0002, 5, 0x0014, 0x0008, 'recovery+proposed', null, 'operation'],
  [0x0002, 6, 0x0017, 0x000d, 'permissionless-mature-trigger', null, 'permissionless'],
  [0x0004, 1, 0x0020, 0x000c, 'governance', 4, 'registered'],
  [0x0004, 2, 0x0020, 0x000c, 'governance', 4, 'registered'],
  [0x0004, 3, 0x0020, 0x000c, 'governance', 4, 'registered'],
  [0x0004, 4, 0x0020, 0x000c, 'pq-registry-emergency-2-of-3-slh-dsa', 4, 'registered'],
  [0x0005, 1, 0x0035, 0x0012, 'bridge-ordinary', 5, 'registered'],
  [0x0006, 1, 0x0100, 0x0030, 'build-ordinary', 6, 'registered'],
  [0x0006, 2, 0x0101, 0x0031, 'compiler-ordinary', 6, 'registered'],
  [0x0006, 3, 0x0102, 0x0032, 'auditor-ordinary', 6, 'registered'],
  [0x0006, 4, 0x0103, 0x0033, 'deployment-ordinary', 6, 'registered'],
  [0x0006, 5, 0x0115, 0x0038, 'governance+completed-issuer-key-transition', 4, 'registered'],
  [0x0006, 6, 0x0112, 0x0036, 'log-ordinary', 6, 'registered'],
].map(([namespace, action, payloadType, domainId, authority, requiredKind, mode]) =>
  Object.freeze({namespace, action, payloadType, domainId, authority, requiredKind, mode})));

const INDEX = new Map(ACTIONS.map(rule => [`${rule.namespace}/${rule.action}`, rule]));
const reject = message => { throw new Error(message); };
const identityLength = kind => [1, 3].includes(kind) ? 20 : 32;

function dispatch(input) {
  const rule = INDEX.get(`${input.namespace}/${input.action}`);
  if (!rule || input.payloadType !== rule.payloadType || input.domainId !== rule.domainId)
    reject('unregistered or mismatched authorization action');
  if (rule.mode === 'permissionless')
    reject('permissionless activation is not a signed authorization');
  if (![1, 2, 3, 4, 5, 6].includes(input.subjectKind) ||
      (rule.requiredKind !== null && input.subjectKind !== rule.requiredKind) ||
      input.boundSubjectKind !== input.subjectKind)
    reject('subject/action binding mismatch');
  const width = identityLength(input.subjectKind);
  if (!Buffer.isBuffer(input.signingSubject) || !Buffer.isBuffer(input.boundSubject) ||
      input.signingSubject.length !== width || input.boundSubject.length !== width ||
      !input.signingSubject.equals(input.boundSubject))
    reject('subject/action binding mismatch');
  if (rule.mode === 'principal' && ![1, 2].includes(input.principalNamespace))
    reject('subject/action principal mismatch');
  if (input.namespace === 0x0004) {
    if (input.innerAction !== input.action) reject('governance inner/outer action mismatch');
    if (input.emergency !== (input.action === 4)) reject('governance emergency flag mismatch');
    if (![1, 2, 3, 4, 5].includes(input.targetType) || (input.action === 4 && input.targetType !== 2))
      reject('governance target mismatch');
  }
  return rule;
}

function mustReject(fn, label) {
  try { fn(); } catch { return; }
  throw new Error(`rejection expected: ${label}`);
}

function registryGovernance(input) {
  if (input.governanceSequence !== input.signingSequence ||
      input.governanceSequence !== input.mutationGovernanceSequence)
    reject('registry governance sequence mismatch');
  if (input.governanceActivationHeight !== input.mutationActivationHeight)
    reject('registry activation height mismatch');
  if (input.commitHeight !== input.consensusHeight)
    reject('registry commit height mismatch');
  if (![3, 4].includes(input.action) || input.emergency !== (input.action === 4))
    reject('registry governance action mismatch');
}

function provenanceMutation(input) {
  if (input.mutationGovernanceSequence !== input.signingSequence)
    reject('provenance governance sequence mismatch');
  if (input.transitionCommitHeight !== input.consensusHeight)
    reject('provenance commit height mismatch');
}

assert.equal(ACTIONS.length, 20);
assert.equal(INDEX.size, 20);
for (const rule of ACTIONS) {
  const kind = rule.requiredKind ?? ((rule.action % 6) + 1);
  const identity = Buffer.alloc(identityLength(kind), rule.action);
  const input = {
    namespace: rule.namespace, action: rule.action,
    payloadType: rule.payloadType, domainId: rule.domainId,
    subjectKind: kind, signingSubject: identity,
    boundSubjectKind: kind, boundSubject: Buffer.from(identity),
    principalNamespace: rule.mode === 'principal' ? 1 : undefined,
    innerAction: rule.namespace === 0x0004 ? rule.action : undefined,
    targetType: rule.namespace === 0x0004 ? (rule.action === 4 ? 2 : 1) : undefined,
    emergency: rule.namespace === 0x0004 ? rule.action === 4 : undefined,
  };
  if (rule.mode === 'permissionless') {
    mustReject(() => dispatch(input), 'permissionless action represented as signed authorization');
    continue;
  }
  assert.equal(dispatch(input).authority, rule.authority);
  mustReject(() => dispatch({...input, payloadType: rule.payloadType ^ 1}), 'payload mismatch');
  mustReject(() => dispatch({...input, domainId: rule.domainId ^ 1}), 'domain mismatch');
}

const emergencyIdentity = Buffer.alloc(32, 4);
const emergencyInput = {
  namespace: 0x0004, action: 4, payloadType: 0x0020, domainId: 0x000c,
  subjectKind: 4, signingSubject: emergencyIdentity,
  boundSubjectKind: 4, boundSubject: Buffer.from(emergencyIdentity),
  innerAction: 4, targetType: 2, emergency: true,
};
assert.equal(dispatch(emergencyInput).authority, 'pq-registry-emergency-2-of-3-slh-dsa');
mustReject(() => dispatch({...emergencyInput, innerAction: 3}), 'governance inner/outer mismatch');
mustReject(() => dispatch({...emergencyInput, targetType: 1}), 'emergency target mismatch');
mustReject(() => dispatch({...emergencyInput, emergency: false}), 'emergency flag mismatch');
mustReject(() => dispatch({
  namespace: 1, action: 1, payloadType: 4, domainId: 2,
  subjectKind: 1, signingSubject: Buffer.alloc(20, 0x61),
  boundSubjectKind: 1, boundSubject: Buffer.alloc(20, 0x62), principalNamespace: 1,
}), 'cross-subject transfer');
for (const [namespace, action] of [[0xffff, 1], [0x0003, 1], [0x0005, 2]])
  mustReject(() => dispatch({namespace, action, payloadType: 1, domainId: 1}), 'unknown action');

const registry = {
  action: 3, governanceSequence: 7, signingSequence: 7, mutationGovernanceSequence: 7,
  governanceActivationHeight: 100, mutationActivationHeight: 100,
  commitHeight: 10, consensusHeight: 10, emergency: false,
};
registryGovernance(registry);
for (const [field, value] of [['signingSequence', 8], ['mutationGovernanceSequence', 8],
  ['mutationActivationHeight', 101], ['consensusHeight', 11]])
  mustReject(() => registryGovernance({...registry, [field]: value}), `registry ${field} mismatch`);
provenanceMutation({mutationGovernanceSequence: 9, signingSequence: 9,
  transitionCommitHeight: 11, consensusHeight: 11});
mustReject(() => provenanceMutation({mutationGovernanceSequence: 9, signingSequence: 8,
  transitionCommitHeight: 11, consensusHeight: 11}), 'provenance sequence mismatch');
mustReject(() => provenanceMutation({mutationGovernanceSequence: 9, signingSequence: 9,
  transitionCommitHeight: 11, consensusHeight: 12}), 'provenance height mismatch');

process.stdout.write(`independent javascript authorization dispatcher verified ${ACTIONS.length} immutable action rows and mismatch rejection\n`);
