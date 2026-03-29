import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

/**
 * Deploy MockLithoBase contract
 * This is a sample deployment script for the contracts template
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log(`Deploying MockLithoBase to ${network.name}...`);
  log(`Deployer: ${deployer}`);

  const mockLithoBase = await deploy('MockLithoBase', {
    from: deployer,
    args: [deployer], // initialOwner
    log: true,
    waitConfirmations: network.live ? 5 : 1,
    autoMine: true,
  });

  log(`MockLithoBase deployed at: ${mockLithoBase.address}`);
  log('----------------------------------------------------');

  // Verify on block explorer if not local network
  if (network.live && process.env.ETHERSCAN_API_KEY) {
    log('Verifying contract on block explorer...');
    try {
      await hre.run('verify:verify', {
        address: mockLithoBase.address,
        constructorArguments: [deployer],
      });
      log('Contract verified successfully!');
    } catch (error) {
      log('Verification failed:', error);
    }
  }
};

func.tags = ['MockLithoBase', 'all'];
func.dependencies = []; // Add dependencies here if needed

export default func;
