import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Check if we're on localhost (deploy MockUSDC) or testnet (use existing USDC)
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  
  let usdcAddress: string;

  if (chainId === 31337) {
    // Localhost - deploy MockUSDC
    console.log("\n📦 Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("✅ MockUSDC deployed to:", usdcAddress);

    // Mint some USDC to deployer for testing
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    console.log(`   Minted ${ethers.formatUnits(mintAmount, 6)} USDC to deployer`);
  } else if (chainId === 84532) {
    // Base Sepolia - use existing USDC
    usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    console.log("\n📦 Using Base Sepolia USDC:", usdcAddress);
  } else {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  // Deploy Factory
  console.log("\n📦 Deploying X402GuardFactory...");
  const Factory = await ethers.getContractFactory("X402GuardFactory");
  const factory = await Factory.deploy(usdcAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✅ X402GuardFactory deployed to:", factoryAddress);

  // For localhost, create a sample Guard wallet for testing
  if (chainId === 31337) {
    console.log("\n📦 Creating sample X402Guard wallet...");
    
    // Use deployer as both owner and agent for testing
    const maxPerTx = ethers.parseUnits("5", 6);      // $5 max per tx
    const dailyLimit = ethers.parseUnits("50", 6);   // $50 daily limit
    const approvalThreshold = ethers.parseUnits("2", 6); // Approve above $2

    const tx = await factory.createGuard(
      deployer.address,  // Agent (same as owner for testing)
      maxPerTx,
      dailyLimit,
      approvalThreshold
    );
    await tx.wait();

    const guards = await factory.getGuardsByOwner(deployer.address);
    const guardAddress = guards[0];
    console.log("✅ Sample X402Guard deployed to:", guardAddress);

    // Fund the guard wallet
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = MockUSDC.attach(usdcAddress);
    
    const fundAmount = ethers.parseUnits("100", 6); // 100 USDC
    await mockUsdc.approve(guardAddress, fundAmount);
    
    const guard = await ethers.getContractAt("X402Guard", guardAddress);
    await guard.fund(fundAmount);
    console.log(`   Funded Guard with ${ethers.formatUnits(fundAmount, 6)} USDC`);

    // Allow all endpoints for testing
    await guard.setAllowAllEndpoints(true);
    console.log("   Enabled 'allow all endpoints' for testing");

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT SUMMARY (localhost)");
    console.log("=".repeat(60));
    console.log(`MockUSDC:         ${usdcAddress}`);
    console.log(`Factory:          ${factoryAddress}`);
    console.log(`Sample Guard:     ${guardAddress}`);
    console.log(`Guard Balance:    ${ethers.formatUnits(await guard.getBalance(), 6)} USDC`);
    console.log(`Daily Limit:      ${ethers.formatUnits(await guard.dailyLimit(), 6)} USDC`);
    console.log(`Max Per Tx:       ${ethers.formatUnits(await guard.maxPerTransaction(), 6)} USDC`);
    console.log(`Approval Above:   ${ethers.formatUnits(await guard.approvalThreshold(), 6)} USDC`);
    console.log("=".repeat(60));

    // Write addresses to file for other packages to use
    const deploymentInfo = {
      chainId,
      usdc: usdcAddress,
      factory: factoryAddress,
      sampleGuard: guardAddress,
      deployer: deployer.address
    };

    const fs = await import("fs");
    fs.writeFileSync(
      "./deployments.local.json",
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n📄 Deployment info written to deployments.local.json");
  } else {
    // Testnet deployment summary
    console.log("\n" + "=".repeat(60));
    console.log("DEPLOYMENT SUMMARY (Base Sepolia)");
    console.log("=".repeat(60));
    console.log(`USDC:             ${usdcAddress}`);
    console.log(`Factory:          ${factoryAddress}`);
    console.log("=".repeat(60));
    console.log("\nNext steps:");
    console.log("1. Create a Guard wallet using the factory");
    console.log("2. Fund it with USDC from the Circle faucet");
    console.log("3. Set your policies and allowed endpoints");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
