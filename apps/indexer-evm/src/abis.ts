/// Contract ABIs — event signatures for indexing
/// These match the events emitted by MatchEscrow.sol and RewardVault.sol

export const matchEscrowAbi = [
  {
    type: "event",
    name: "MatchCreated",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "player1", type: "address", indexed: false },
      { name: "player2", type: "address", indexed: false },
      { name: "depositAmount", type: "uint256", indexed: false },
      { name: "timeoutBlock", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MatchFunded",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Draw",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "player1", type: "address", indexed: false },
      { name: "player2", type: "address", indexed: false },
      { name: "refundEach", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MatchCancelled",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
    ],
  },
] as const;

export const rewardVaultAbi = [
  {
    type: "event",
    name: "RewardPaid",
    inputs: [
      { name: "sessionId", type: "bytes32", indexed: true },
      { name: "seq", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "proofHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ProofRecorded",
    inputs: [
      { name: "sessionId", type: "bytes32", indexed: true },
      { name: "seq", type: "uint256", indexed: true },
      { name: "proofHash", type: "bytes32", indexed: false },
      { name: "payload", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Funded",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
