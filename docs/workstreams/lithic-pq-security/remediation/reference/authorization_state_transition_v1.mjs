// Independent JavaScript AUTHORIZATION_STATE_TRANSITION_V1 conformance runner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'vectors', 'authorization_state_transitions.json');
const vectors = JSON.parse(fs.readFileSync(file, 'utf8'));
const MIN_CANCELLATION_WINDOW = 10;
const MIN_ACTIVATION_DELAY = 11;
const MAX_PENDING_HORIZON = 100000;
class Rejected extends Error {}
const clone = value => JSON.parse(JSON.stringify(value));
const findKey = (state, slot, epoch) => state.keys.find(item => item.slot === slot && item.epoch === epoch);
const nextEpoch = (state, slot) => Math.max(0, ...state.keys.filter(item => item.slot === slot).map(item => item.epoch)) + 1;

function request(state, op, consensusHeight) {
  if (state.pending !== null) throw new Rejected('PENDING_EXISTS');
  if (!['REGISTER', 'ROTATE', 'DISABLE', 'RECOVER'].includes(op.kind)) throw new Rejected('UNKNOWN_OPERATION');
  if (op.deadline < consensusHeight + MIN_CANCELLATION_WINDOW) throw new Rejected('CANCELLATION_WINDOW_TOO_SHORT');
  if (op.activation <= op.deadline || op.activation < consensusHeight + MIN_ACTIVATION_DELAY) throw new Rejected('INVALID_WINDOW');
  if (op.activation > consensusHeight + MAX_PENDING_HORIZON) throw new Rejected('PENDING_HORIZON_EXCEEDED');
  const prior = op.prior_epoch ?? 0;
  if (['REGISTER', 'ROTATE', 'RECOVER'].includes(op.kind) && op.epoch !== nextEpoch(state, op.slot)) throw new Rejected('NON_MONOTONIC_EPOCH');
  if (op.kind === 'REGISTER' && prior !== 0) throw new Rejected('INVALID_PREDECESSOR');
  if (['ROTATE', 'DISABLE'].includes(op.kind)) {
    const old = findKey(state, op.slot, prior);
    if (!old || old.state !== 'ACTIVE') throw new Rejected('NO_ACTIVE_PREDECESSOR');
  }
  if (op.kind === 'RECOVER') {
    const old = findKey(state, op.prior_slot, prior);
    if (!old || old.state !== 'ACTIVE') throw new Rejected('NO_ACTIVE_PREDECESSOR');
  }
  state.pending = {kind: op.kind, slot: op.slot, epoch: op.epoch, prior_epoch: prior, prior_slot: op.prior_slot ?? (op.kind === 'REGISTER' ? 0 : op.slot), deadline: op.deadline, activation: op.activation, next_policy_version: state.policy_version + 1, next_authorization_epoch: state.authorization_epoch + 1};
  if (op.kind !== 'DISABLE') state.keys.push({slot: op.slot, epoch: op.epoch, state: 'PENDING_ACTIVATION'});
  state.records.push(`${op.kind}_REQUESTED`);
}

function cancel(state, op, consensusHeight) {
  const pending = state.pending;
  if (!pending) throw new Rejected('NO_PENDING_MUTATION');
  const recoveryCancel = (op.authority ?? 'ordinary') === 'recovery' && consensusHeight < pending.activation;
  if (consensusHeight > pending.deadline && !recoveryCancel) throw new Rejected('CANCELLATION_CLOSED');
  if (pending.kind !== 'DISABLE') {
    const proposed = findKey(state, pending.slot, pending.epoch);
    if (!proposed || proposed.state !== 'PENDING_ACTIVATION') throw new Rejected('PENDING_KEY_MISMATCH');
    proposed.state = 'CANCELLED';
  }
  state.pending = null;
  state.records.push('PENDING_CANCELLED');
}

function activate(state, op, consensusHeight) {
  const pending = state.pending;
  if (!pending) throw new Rejected('NO_PENDING_MUTATION');
  if ('claimed_execution_height' in op) throw new Rejected('UNREGISTERED_EXECUTION_HEIGHT_FIELD');
  if (consensusHeight < pending.activation || consensusHeight <= pending.deadline) throw new Rejected('NOT_MATURE');
  if (pending.kind === 'REGISTER') findKey(state, pending.slot, pending.epoch).state = 'ACTIVE';
  else if (pending.kind === 'ROTATE') {
    findKey(state, pending.slot, pending.prior_epoch).state = 'ROTATED';
    findKey(state, pending.slot, pending.epoch).state = 'ACTIVE';
  } else if (pending.kind === 'DISABLE') findKey(state, pending.slot, pending.prior_epoch).state = 'DISABLED';
  else if (pending.kind === 'RECOVER') {
    findKey(state, pending.prior_slot, pending.prior_epoch).state = 'RECOVERED';
    findKey(state, pending.slot, pending.epoch).state = 'ACTIVE';
  } else throw new Rejected('UNKNOWN_OPERATION');
  state.policy_version = pending.next_policy_version;
  state.authorization_epoch = pending.next_authorization_epoch;
  state.pending = null;
  state.records.push('PENDING_ACTIVATED');
}

function governance(state, op, consensusHeight) {
  if (op.action !== op.inner_action || op.action !== 4 || op.target_type !== 2 || op.emergency !== true) throw new Rejected('GOVERNANCE_DISPATCH_MISMATCH');
  if (op.authority !== 'PQ_REGISTRY_EMERGENCY_2_OF_3') throw new Rejected('WRONG_AUTHORITY_ROOT');
  state.records.push('EMERGENCY_DISABLE_AUTHORIZED');
}

const handlers = {request, cancel, activate, governance};
function run(test) {
  let state = clone(test.initial);
  state.pending ??= null;
  state.records ??= [];
  const accepted = [], errors = [];
  for (const step of test.operations) {
    const before = clone(state);
    const consensusHeight = step.height;
    const operation = Object.fromEntries(Object.entries(step).filter(([key]) => key !== 'height'));
    try {
      handlers[operation.type](state, operation, consensusHeight);
      accepted.push(true); errors.push('OK');
    } catch (error) {
      if (!(error instanceof Rejected)) throw error;
      state = before; accepted.push(false); errors.push(error.message);
    }
  }
  state.keys.sort((a, b) => a.slot - b.slot || a.epoch - b.epoch);
  return {accepted, errors, ...state};
}

if (vectors.schema !== 'AUTHORIZATION_STATE_TRANSITION_V1') throw new Error('wrong vector schema');
for (const test of vectors.cases) {
  const actual = run(test);
  if (JSON.stringify(actual) !== JSON.stringify(test.expected)) throw new Error(`state transition mismatch: ${test.name}\nexpected=${JSON.stringify(test.expected)}\nactual=${JSON.stringify(actual)}`);
}
process.stdout.write(`javascript authorization state machine verified ${vectors.cases.length} complete sequences\n`);
