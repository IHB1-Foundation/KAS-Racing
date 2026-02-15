/**
 * Contract ABIs for server-side contract interactions
 * Covers only the functions the server needs to call
 */

export const matchEscrowAbi = [
  // Write functions (operator)
  {
    type: "function",
    name: "createMatch",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "player1", type: "address" },
      { name: "player2", type: "address" },
      { name: "depositAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "winner", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settleDraw",
    inputs: [
      { name: "matchId", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancel",
    inputs: [
      { name: "matchId", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Read functions
  {
    type: "function",
    name: "getMatch",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "player1", type: "address" },
          { name: "player2", type: "address" },
          { name: "depositAmount", type: "uint256" },
          { name: "timeoutBlock", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "player1Deposited", type: "bool" },
          { name: "player2Deposited", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMatchState",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export const rewardVaultAbi = [
  // Write functions (operator)
  {
    type: "function",
    name: "payReward",
    inputs: [
      { name: "sessionId", type: "bytes32" },
      { name: "seq", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "proofHash", type: "bytes32" },
      { name: "payload", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Read functions
  {
    type: "function",
    name: "isPaid",
    inputs: [
      { name: "sessionId", type: "bytes32" },
      { name: "seq", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vaultBalance",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalPaid",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const fuelTokenAbi = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
