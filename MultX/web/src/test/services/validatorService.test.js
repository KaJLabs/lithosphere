import axios from 'axios';
import {
  fetchAllValidators,
  getPublicValidators,
  getValidatorDisplayName,
  getValidatorDisplayStatus,
  getValidatorVotingPower,
  sortValidators
} from '../../services/validatorService';
import { validators } from '../fixtures/explorerFixtures';

vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('validatorService', () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it('fetches validators across statuses and deduplicates paginated results', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('status=BOND_STATUS_BONDED') && !url.includes('pagination.key=')) {
        return Promise.resolve({
          data: {
            validators: [validators[0]],
            pagination: {
              next_key: 'next-bonded'
            }
          }
        });
      }

      if (url.includes('status=BOND_STATUS_BONDED') && url.includes('pagination.key=next-bonded')) {
        return Promise.resolve({
          data: {
            validators: [validators[1]],
            pagination: {
              next_key: null
            }
          }
        });
      }

      if (url.includes('status=BOND_STATUS_UNBONDING')) {
        return Promise.resolve({
          data: {
            validators: [validators[2]],
            pagination: {
              next_key: null
            }
          }
        });
      }

      if (url.includes('status=BOND_STATUS_UNBONDED')) {
        return Promise.resolve({
          data: {
            validators: [validators[1]],
            pagination: {
              next_key: null
            }
          }
        });
      }

      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    const allValidators = await fetchAllValidators();
    expect(allValidators).toHaveLength(3);
  });

  it('derives public validator details and statuses correctly', () => {
    const publicValidators = getPublicValidators(validators);
    expect(publicValidators).toHaveLength(2);
    expect(getValidatorDisplayName(validators[0])).toBe('kamet-validator');
    expect(getValidatorDisplayStatus(validators[0])).toBe('Bonded');
    expect(getValidatorDisplayStatus(validators[2])).toBe('Jailed / Unbonding');
    expect(getValidatorVotingPower(validators[2])).toBe(0);
  });

  it('sorts validators by status priority and voting power', () => {
    const sorted = sortValidators(validators);
    expect(sorted[0].operator_address).toBe(validators[0].operator_address);
    expect(sorted[1].operator_address).toBe(validators[1].operator_address);
  });
});
