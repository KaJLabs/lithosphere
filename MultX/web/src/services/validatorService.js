import axios from 'axios';
import { CosmosAPI } from '../config/api';

const VALIDATOR_STATUSES = [
  'BOND_STATUS_BONDED',
  'BOND_STATUS_UNBONDING',
  'BOND_STATUS_UNBONDED',
];

const STATUS_PRIORITY = {
  BOND_STATUS_BONDED: 0,
  BOND_STATUS_UNBONDING: 1,
  BOND_STATUS_UNBONDED: 2,
};

const PAGE_LIMIT = 200;
const PROVIDER_TOKEN_PATTERN = /^(aws|gcp|azure|ec2|digitalocean|do|vps\d*|srv\d*)$/i;

const buildValidatorsUrl = (status, paginationKey = null) => {
  const params = new URLSearchParams();
  params.set('status', status);
  params.set('pagination.limit', String(PAGE_LIMIT));
  params.set('pagination.count_total', 'true');

  if (paginationKey) {
    params.set('pagination.key', paginationKey);
  }

  return `${CosmosAPI.validators()}?${params.toString()}`;
};

const fetchValidatorsByStatus = async (status) => {
  const validators = [];
  let nextKey = null;

  do {
    const response = await axios.get(buildValidatorsUrl(status, nextKey));
    validators.push(...(response.data?.validators || []));
    nextKey = response.data?.pagination?.next_key || null;
  } while (nextKey);

  return validators;
};

export const fetchAllValidators = async () => {
  const validatorGroups = await Promise.all(VALIDATOR_STATUSES.map(fetchValidatorsByStatus));
  const uniqueValidators = new Map();

  validatorGroups.flat().forEach((validator) => {
    if (!validator?.operator_address || uniqueValidators.has(validator.operator_address)) {
      return;
    }

    uniqueValidators.set(validator.operator_address, validator);
  });

  return Array.from(uniqueValidators.values());
};

export const isActiveValidator = (validator) =>
  validator?.status === 'BOND_STATUS_BONDED' && !validator?.jailed;

export const getPublicValidators = (validators = []) =>
  validators.filter(isActiveValidator);

export const getValidatorDisplayName = (validator) => {
  const moniker = validator?.description?.moniker?.trim();
  if (!moniker) {
    return 'N/A';
  }

  const sanitized = moniker
    .split('-')
    .filter((segment) => segment && !PROVIDER_TOKEN_PATTERN.test(segment))
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || moniker;
};

export const getValidatorVotingPower = (validator) =>
  isActiveValidator(validator) ? Number(validator?.tokens || 0) : 0;

export const getValidatorDisplayStatus = (validator) => {
  if (validator?.jailed) {
    switch (validator?.status) {
      case 'BOND_STATUS_UNBONDING':
        return 'Jailed / Unbonding';
      case 'BOND_STATUS_UNBONDED':
        return 'Jailed / Unbonded';
      default:
        return 'Jailed';
    }
  }

  switch (validator?.status) {
    case 'BOND_STATUS_BONDED':
      return 'Bonded';
    case 'BOND_STATUS_UNBONDING':
      return 'Unbonding';
    case 'BOND_STATUS_UNBONDED':
      return 'Unbonded';
    default:
      return 'Unknown';
  }
};

export const sortValidators = (validators) =>
  [...validators].sort((left, right) => {
    const statusDelta =
      (STATUS_PRIORITY[left.status] ?? Number.MAX_SAFE_INTEGER) -
      (STATUS_PRIORITY[right.status] ?? Number.MAX_SAFE_INTEGER);

    if (statusDelta !== 0) {
      return statusDelta;
    }

    const tokenDelta = Number(right.tokens || 0) - Number(left.tokens || 0);
    if (tokenDelta !== 0) {
      return tokenDelta;
    }

    return getValidatorDisplayName(left).localeCompare(getValidatorDisplayName(right));
  });
