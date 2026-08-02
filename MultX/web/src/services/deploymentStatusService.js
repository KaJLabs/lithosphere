import { CHAIN_CONFIG } from '../config/api';
import { MULTX_CONFIG, MultXAPI } from '../config/multxClient';

const nowIsoString = () => new Date().toISOString();

const readJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const formatHttpStatus = (statusCode) => (statusCode ? `HTTP ${statusCode}` : 'network error');

const buildBridgeDeploymentMessage = ({
  bridgeAddress,
  tokenAddress,
  bridgeContractReady,
  tokenContractReady,
  healthError
}) => {
  if (healthError) {
    return `Unable to confirm Kamet bridge deployment readiness: ${healthError}`;
  }

  if (!bridgeAddress) {
    return 'Bridge maintenance mode: the Kamet bridge contract address is not configured in this build.';
  }

  if (!tokenAddress) {
    return 'Bridge maintenance mode: the Kamet LITHO token address is not configured in this build.';
  }

  if (!bridgeContractReady) {
    return `Bridge maintenance mode: the configured Kamet bridge contract (${bridgeAddress}) is not deployed on the current network.`;
  }

  if (!tokenContractReady) {
    return `Bridge maintenance mode: the configured Kamet LITHO token (${tokenAddress}) is not deployed on the current network.`;
  }

  return 'Kamet bridge contracts are deployed and ready.';
};

export const createInitialFaucetAvailability = () => ({
  loading: true,
  configured: Boolean(CHAIN_CONFIG.faucetClaimUrl),
  ready: false,
  status: CHAIN_CONFIG.faucetClaimUrl ? 'checking' : 'unconfigured',
  statusCode: null,
  message: CHAIN_CONFIG.faucetClaimUrl
    ? 'Checking live Kamet faucet claim availability...'
    : 'Faucet claim URL is not configured in this build.',
  checkedAt: ''
});

export const probeFaucetClaimAvailability = async () => {
  if (!CHAIN_CONFIG.faucetClaimUrl) {
    return {
      ...createInitialFaucetAvailability(),
      loading: false,
      checkedAt: nowIsoString()
    };
  }

  try {
    const response = await fetch(CHAIN_CONFIG.faucetClaimUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: 'not-an-address',
        amount: '1',
        addressType: 'EVM'
      })
    });
    const payload = await readJsonResponse(response);
    const routeReady = [400, 429].includes(response.status);

    let message = payload?.message || '';

    if (!message) {
      if (routeReady) {
        message = 'Live Kamet faucet claim checks are responding normally.';
      } else if (response.status === 404) {
        message = 'Faucet maintenance mode: the live claim route is not mounted on api-3.litho.ai.';
      } else {
        message = `Faucet maintenance mode: the claim service is unavailable (${formatHttpStatus(response.status)}).`;
      }
    }

    return {
      loading: false,
      configured: true,
      ready: routeReady,
      status: routeReady ? 'ready' : response.status === 404 ? 'missing' : 'maintenance',
      statusCode: response.status,
      message,
      checkedAt: nowIsoString()
    };
  } catch (error) {
    return {
      loading: false,
      configured: true,
      ready: false,
      status: 'maintenance',
      statusCode: null,
      message: `Faucet maintenance mode: unable to reach the live claim service (${error.message}).`,
      checkedAt: nowIsoString()
    };
  }
};

export const createInitialBridgeDeploymentStatus = () => ({
  loading: true,
  bridgeApiConfigured: Boolean(MULTX_CONFIG.bridgeApiUrl),
  apiAvailable: false,
  ready: false,
  status: MULTX_CONFIG.bridgeApiUrl ? 'checking' : 'unconfigured',
  statusCode: null,
  bridgeAddress: MULTX_CONFIG.bridgeAddress || '',
  tokenAddress: MULTX_CONFIG.lithoTokenAddress || '',
  bridgeContractReady: false,
  tokenContractReady: false,
  message: MULTX_CONFIG.bridgeApiUrl
    ? 'Checking live Kamet bridge deployment readiness...'
    : 'Bridge API URL is not configured in this build.',
  checkedAt: '',
  healthError: ''
});

export const fetchBridgeDeploymentStatus = async () => {
  if (!MULTX_CONFIG.bridgeApiUrl) {
    return {
      ...createInitialBridgeDeploymentStatus(),
      loading: false,
      checkedAt: nowIsoString()
    };
  }

  try {
    const response = await fetch(MultXAPI.health());
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      return {
        loading: false,
        bridgeApiConfigured: true,
        apiAvailable: false,
        ready: false,
        status: 'maintenance',
        statusCode: response.status,
        bridgeAddress: MULTX_CONFIG.bridgeAddress || '',
        tokenAddress: MULTX_CONFIG.lithoTokenAddress || '',
        bridgeContractReady: false,
        tokenContractReady: false,
        message: payload?.message || `Bridge maintenance mode: the bridge health service is unavailable (${formatHttpStatus(response.status)}).`,
        checkedAt: nowIsoString(),
        healthError: ''
      };
    }

    const deployment = payload?.deployment || {};
    const bridgeAddress = deployment.bridgeAddress || MULTX_CONFIG.bridgeAddress || '';
    const tokenAddress = deployment.kametTokenAddress || MULTX_CONFIG.lithoTokenAddress || '';
    const bridgeContractReady = Boolean(deployment.bridgeContractDeployed);
    const tokenContractReady = Boolean(deployment.kametTokenContractDeployed);
    const healthError = deployment.error || '';
    const ready = bridgeContractReady && tokenContractReady;

    return {
      loading: false,
      bridgeApiConfigured: true,
      apiAvailable: true,
      ready,
      status: ready ? 'ready' : 'maintenance',
      statusCode: response.status,
      bridgeAddress,
      tokenAddress,
      bridgeContractReady,
      tokenContractReady,
      message: buildBridgeDeploymentMessage({
        bridgeAddress,
        tokenAddress,
        bridgeContractReady,
        tokenContractReady,
        healthError
      }),
      checkedAt: nowIsoString(),
      healthError
    };
  } catch (error) {
    return {
      loading: false,
      bridgeApiConfigured: true,
      apiAvailable: false,
      ready: false,
      status: 'maintenance',
      statusCode: null,
      bridgeAddress: MULTX_CONFIG.bridgeAddress || '',
      tokenAddress: MULTX_CONFIG.lithoTokenAddress || '',
      bridgeContractReady: false,
      tokenContractReady: false,
      message: `Bridge maintenance mode: unable to reach the bridge health service (${error.message}).`,
      checkedAt: nowIsoString(),
      healthError: error.message
    };
  }
};
