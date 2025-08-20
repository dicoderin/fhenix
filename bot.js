import { ethers } from 'ethers';
import chalk from 'chalk';
import readline from 'readline';
import fs from 'fs/promises';

// --- Configuration ---
const CONFIG = {
  RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  CHAIN_ID: 11155111,
  MIN_AMOUNT_ETH: 0.0001,
  MAX_AMOUNT_ETH: 0.0004,
  PRIORITY_FEE_GWEI: 0.26,
  TIMEZONE_OFFSET_MIN: 330, // IST (UTC+5:30)
  MIN_DELAY_SEC: 1,
  MAX_DELAY_SEC: 5,
};

const PROXY_ADDRESS = '0xf993E10C83Fe26DddFc6cb5E82444C44201e8a9C';
const EXPLORER_URL = 'https://sepolia.etherscan.io/tx/';

const INBOX_MIN_ABI = [
  { "inputs": [], "name": "depositEth", "outputs": [], "stateMutability": "payable", "type": "function" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "messageNum", "type": "uint256" },
      { "indexed": false, "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "InboxMessageDelivered",
    "type": "event"
  }
];

// --- Banner ---
const BANNER = `
███████╗██╗  ██╗███████╗███╗   ██╗██╗██╗  ██╗
██╔════╝██║  ██║██╔════╝████╗  ██║██║╚██╗██╔╝
█████╗  ███████║█████╗  ██╔██╗ ██║██║ ╚███╔╝ 
██╔══╝  ██╔══██║██╔══╝  ██║╚██╗██║██║ ██╔██╗ 
██║     ██║  ██║███████╗██║ ╚████║██║██╔╝ ██╗
╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝

 LETS FUCK THIS TESTNET CREATED BY Allowindo                                            
       fhenix Auto Bot - By Allowindo
`;

// --- Utility Functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
};

function hhmmss(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function randomInt(minIncl, maxIncl) {
  return Math.floor(Math.random() * (maxIncl - minIncl + 1)) + minIncl;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function formatEth(wei) {
  return chalk.yellow(`${ethers.formatEther(wei)} ETH`);
}

function formatGwei(wei) {
  return chalk.yellow(`${Number(wei) / 1e9} gwei`);
}

function nowUtcMs() {
  return Date.now();
}

function msUntilNextLocalMidnight(offsetMin) {
  const now = new Date(nowUtcMs());
  const localMs = now.getTime() + offsetMin * 60_000;
  const local = new Date(localMs);
  const nextLocalMidnight = new Date(local.getFullYear(), local.getMonth(), local.getDate() + 1, 0, 0, 0, 0);
  const nextLocalMidnightUtcMs = nextLocalMidnight.getTime() - offsetMin * 60_000;
  const diff = nextLocalMidnightUtcMs - now.getTime();
  return diff > 0 ? diff : 0;
}

function progressBar(done, total) {
  const width = 20;
  const filled = Math.round((done / total) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('─'.repeat(empty));
}

// --- Ethereum Functions ---
async function readPrivateKey() {
  console.log(chalk.cyan('⟐ Loading private key from pv.txt...'));
  try {
    const privateKey = await fs.readFile('pv.txt', 'utf8');
    const trimmedKey = privateKey.trim();
    if (!trimmedKey.match(/^0x[a-fA-F0-9]{64}$/)) {
      console.error(chalk.red('✖ Invalid private key format in pv.txt. Expected 64 hex characters starting with 0x.'));
      throw new Error('Invalid private key format.');
    }
    console.log(chalk.green('✔ Private key loaded.'));
    return trimmedKey;
  } catch (error) {
    console.error(chalk.red('✖ Failed to read pv.txt. Ensure the file exists and contains a valid private key.'));
    throw error;
  }
}

async function initializeClient() {
  console.log(chalk.cyan('⟐ Initializing Ethereum client...'));
  try {
    const privateKey = await readPrivateKey();
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const inbox = new ethers.Contract(PROXY_ADDRESS, INBOX_MIN_ABI, wallet);
    const chainId = Number(await provider.getNetwork().then(n => n.chainId));
    if (chainId != CONFIG.CHAIN_ID) {
      console.error(chalk.red(`✖ Chain ID mismatch. Expected ${CONFIG.CHAIN_ID}, got ${chainId} (type: ${typeof chainId}).`));
      throw new Error(`Chain ID mismatch: expected ${CONFIG.CHAIN_ID}, got ${chainId}.`);
    }
    console.log(chalk.green(`✔ Client initialized. Wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`));
    return { provider, wallet, inbox, address: wallet.address };
  } catch (error) {
    console.error(chalk.red(`✖ Failed to initialize client: ${error.message}`));
    throw error;
  }
}

async function suggestFees(provider) {
  console.log(chalk.cyan('⟐ Calculating gas fees...'));
  try {
    const block = await provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas ?? null;
    const priorityWei = BigInt(Math.floor(CONFIG.PRIORITY_FEE_GWEI * 1e9));

    if (baseFee === null) {
      const gp = await provider.getGasPrice();
      console.log(chalk.green('✔ Gas fees calculated (legacy).'));
      return {
        type: 2,
        maxFeePerGas: gp,
        maxPriorityFeePerGas: gp / 8n
      };
    }

    const maxFee = 2n * baseFee + priorityWei;
    console.log(chalk.green('✔ Gas fees calculated.'));
    return {
      type: 2,
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: priorityWei
    };
  } catch (error) {
    console.error(chalk.red(`✖ Failed to calculate gas fees: ${error.message}`));
    throw error;
  }
}

function tryDecodeInboxEvents(receipt) {
  const iface = new ethers.Interface(INBOX_MIN_ABI);
  const events = [];
  for (const log of receipt.logs || []) {
    if (log.address.toLowerCase() !== PROXY_ADDRESS.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === 'InboxMessageDelivered') {
        const messageNum = parsed.args.messageNum?.toString?.() ?? parsed.args[0]?.toString?.();
        const dataHex = ethers.hexlify(parsed.args.data ?? parsed.args[1] ?? '0x');
        events.push(chalk.gray(`│ Event: InboxMessageDelivered (messageNum=${messageNum}, data=${dataHex.slice(0, 20)}...)`));
      }
    } catch (_) { /* ignore */ }
  }
  return events;
}

async function sendOneDeposit(context, cycleCount, totalSwaps) {
  console.log(chalk.cyan(`┳━━━━━━━━ Cycle ${cycleCount}/${totalSwaps} | ${new Date().toLocaleString()} ━━━━━━━━`));
  try {
    const amountEth = randomFloat(CONFIG.MIN_AMOUNT_ETH, CONFIG.MAX_AMOUNT_ETH);
    const valueWei = ethers.parseEther(amountEth.toFixed(18));
    const fee = await suggestFees(context.provider);

    const overrides = {
      value: valueWei,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
    };

    let gasEstimate = null;
    try {
      gasEstimate = await context.inbox.depositEth.estimateGas(overrides);
    } catch (error) {
      console.log(chalk.yellow('│ Warning: Gas estimation failed, proceeding anyway.'));
    }

    console.log(chalk.white(`│ Value : ${formatEth(valueWei)}`));
    console.log(chalk.white(`│ Gas   : ${gasEstimate ? gasEstimate.toString() : 'N/A'}`));
    console.log(chalk.white(`│ Fees  : ${formatGwei(fee.maxFeePerGas)} (max) | ${formatGwei(fee.maxPriorityFeePerGas)} (tip)`));

    console.log(chalk.cyan('│ Sending deposit...'));
    const tx = await context.inbox.depositEth(overrides);
    console.log(chalk.white(`│ Tx    : ${chalk.blue(`${EXPLORER_URL}${tx.hash}`)}`));

    console.log(chalk.cyan('│ Awaiting confirmation...'));
    const rcpt = await tx.wait();
    const ok = rcpt.status === 1;

    console.log(chalk.white(`│ Status: ${ok ? chalk.green('SUCCESS') : chalk.red('FAILED')}`));
    console.log(chalk.white(`│ Block : ${rcpt.blockNumber}`));
    console.log(chalk.white(`│ Gas Used: ${rcpt.gasUsed?.toString?.()}`));

    const events = tryDecodeInboxEvents(rcpt);
    events.forEach(event => console.log(event));

    console.log(chalk.cyan(`┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));

    if (!ok) {
      console.log(chalk.yellow('│ Note: Transaction failed, continuing...'));
      return false;
    }

    return true;
  } catch (error) {
    console.log(chalk.cyan(`┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.error(chalk.red(`✖ Cycle ${cycleCount}/${totalSwaps} failed: ${error.message}`));
    throw error;
  }
}

function nextDelayMs() {
  const sec = randomInt(CONFIG.MIN_DELAY_SEC, CONFIG.MAX_DELAY_SEC);
  return sec * 1000;
}

// --- Main Function ---
const main = async () => {
  console.log(chalk.magenta(BANNER));
  console.log(chalk.cyan('⟐ Initializing Ethereum Deposit Bot...'));

  // --- Get user input for number of swaps ---
  let NUMBER_OF_SWAPS;
  while (true) {
    const userInput = await askQuestion(chalk.cyan('Enter daily deposits (e.g., 30): '));
    const parsedSwaps = parseInt(userInput);
    if (!isNaN(parsedSwaps) && parsedSwaps > 0) {
      NUMBER_OF_SWAPS = parsedSwaps;
      console.log(chalk.green(`✔ Target set: ${NUMBER_OF_SWAPS} daily deposits`));
      break;
    } else {
      console.log(chalk.red('✖ Invalid input. Enter a positive integer (e.g., 30).'));
    }
  }

  // --- Validate configuration ---
  if (!(CONFIG.MIN_AMOUNT_ETH > 0 && CONFIG.MAX_AMOUNT_ETH >= CONFIG.MIN_AMOUNT_ETH)) {
    console.error(chalk.red('✖ Invalid ETH amount range.'));
    process.exit(1);
  }
  if (!(CONFIG.MIN_DELAY_SEC > 0 && CONFIG.MAX_DELAY_SEC >= CONFIG.MIN_DELAY_SEC)) {
    console.error(chalk.red('✖ Invalid delay range.'));
    process.exit(1);
  }

  try {
    const context = await initializeClient();
    console.log(chalk.cyan(`\n⟐ Bot ready. Wallet: ${context.address.slice(0, 6)}...${context.address.slice(-4)}`));
    console.log(chalk.cyan(`⟐ Starting ${NUMBER_OF_SWAPS} daily deposits`));

    let doneToday = 0;

    while (true) {
      const msLeft = msUntilNextLocalMidnight(CONFIG.TIMEZONE_OFFSET_MIN);

      if (doneToday >= NUMBER_OF_SWAPS) {
        let remaining = msUntilNextLocalMidnight(CONFIG.TIMEZONE_OFFSET_MIN);
        console.log(chalk.green(`\n✔ Daily quota reached (${doneToday}/${NUMBER_OF_SWAPS}) [${progressBar(doneToday, NUMBER_OF_SWAPS)}]`));
        console.log(chalk.cyan(`⟐ Waiting for next day (${hhmmss(remaining)})...`));
        await sleep(remaining);
        console.log(chalk.green('✔ New day! Resetting counters.'));
        doneToday = 0;
        console.log(chalk.cyan(`⟐ [${new Date().toISOString()}] New target: ${NUMBER_OF_SWAPS} deposits`));
      }

      if (msLeft === 0 && doneToday === 0) {
        console.log(chalk.cyan(`⟐ [${new Date().toISOString()}] New target: ${NUMBER_OF_SWAPS} deposits`));
      }

      if (doneToday < NUMBER_OF_SWAPS) {
        try {
          const success = await sendOneDeposit(context, doneToday + 1, NUMBER_OF_SWAPS);
          if (success) doneToday += 1;
          console.log(chalk.green(`✔ Progress: ${doneToday}/${NUMBER_OF_SWAPS} deposits [${progressBar(doneToday, NUMBER_OF_SWAPS)}]`));
        } catch (error) {
          console.error(chalk.red(`✖ [Cycle ${doneToday + 1}/${NUMBER_OF_SWAPS}] Error: ${error.message}`));
          if (error.message.includes('insufficient funds')) {
            console.log(chalk.yellow('⚠ Insufficient funds. Retrying in 1 hour...'));
            await sleep(3600 * 1000);
            continue;
          } else {
            console.log(chalk.yellow('⚠ Unexpected error. Retrying in 10 seconds...'));
            await sleep(10 * 1000);
            continue;
          }
        }

        const remain = NUMBER_OF_SWAPS - doneToday;
        const delay = nextDelayMs();
        console.log(chalk.cyan(`⟐ Next deposit in ${Math.round(delay/1000)}s (${remain} remaining)...`));
        await sleep(delay);
      }
    }
  } catch (error) {
    console.error(chalk.red(`✖ Fatal error: ${error.message}`));
    process.exit(1);
  }
};

main();
