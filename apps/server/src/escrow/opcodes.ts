/**
 * Kaspa Script Opcodes
 *
 * Reference: https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/core/src/tx/script_public_key.rs
 *
 * Note: KIP-10 covenant opcodes (0xC3-0xCA) are only active on Testnet 12+
 */

// Push value
export const OP_0 = 0x00;
export const OP_FALSE = 0x00;
export const OP_DATA_1 = 0x01;
export const OP_DATA_32 = 0x20;
export const OP_DATA_33 = 0x21;
export const OP_PUSHDATA1 = 0x4c;
export const OP_PUSHDATA2 = 0x4d;
export const OP_PUSHDATA4 = 0x4e;
export const OP_1NEGATE = 0x4f;
export const OP_RESERVED = 0x50;
export const OP_TRUE = 0x51;
export const OP_1 = 0x51;
export const OP_2 = 0x52;
export const OP_3 = 0x53;
export const OP_4 = 0x54;
export const OP_5 = 0x55;
export const OP_6 = 0x56;
export const OP_7 = 0x57;
export const OP_8 = 0x58;
export const OP_9 = 0x59;
export const OP_10 = 0x5a;
export const OP_11 = 0x5b;
export const OP_12 = 0x5c;
export const OP_13 = 0x5d;
export const OP_14 = 0x5e;
export const OP_15 = 0x5f;
export const OP_16 = 0x60;

// Control
export const OP_NOP = 0x61;
export const OP_VER = 0x62;
export const OP_IF = 0x63;
export const OP_NOTIF = 0x64;
export const OP_VERIF = 0x65;
export const OP_VERNOTIF = 0x66;
export const OP_ELSE = 0x67;
export const OP_ENDIF = 0x68;
export const OP_VERIFY = 0x69;
export const OP_RETURN = 0x6a;

// Stack
export const OP_TOALTSTACK = 0x6b;
export const OP_FROMALTSTACK = 0x6c;
export const OP_2DROP = 0x6d;
export const OP_2DUP = 0x6e;
export const OP_3DUP = 0x6f;
export const OP_2OVER = 0x70;
export const OP_2ROT = 0x71;
export const OP_2SWAP = 0x72;
export const OP_IFDUP = 0x73;
export const OP_DEPTH = 0x74;
export const OP_DROP = 0x75;
export const OP_DUP = 0x76;
export const OP_NIP = 0x77;
export const OP_OVER = 0x78;
export const OP_PICK = 0x79;
export const OP_ROLL = 0x7a;
export const OP_ROT = 0x7b;
export const OP_SWAP = 0x7c;
export const OP_TUCK = 0x7d;

// Splice
export const OP_CAT = 0x7e;
export const OP_SUBSTR = 0x7f;
export const OP_LEFT = 0x80;
export const OP_RIGHT = 0x81;
export const OP_SIZE = 0x82;

// Bitwise logic
export const OP_INVERT = 0x83;
export const OP_AND = 0x84;
export const OP_OR = 0x85;
export const OP_XOR = 0x86;
export const OP_EQUAL = 0x87;
export const OP_EQUALVERIFY = 0x88;
export const OP_RESERVED1 = 0x89;
export const OP_RESERVED2 = 0x8a;

// Arithmetic
export const OP_1ADD = 0x8b;
export const OP_1SUB = 0x8c;
export const OP_2MUL = 0x8d;
export const OP_2DIV = 0x8e;
export const OP_NEGATE = 0x8f;
export const OP_ABS = 0x90;
export const OP_NOT = 0x91;
export const OP_0NOTEQUAL = 0x92;
export const OP_ADD = 0x93;
export const OP_SUB = 0x94;
export const OP_MUL = 0x95;
export const OP_DIV = 0x96;
export const OP_MOD = 0x97;
export const OP_LSHIFT = 0x98;
export const OP_RSHIFT = 0x99;
export const OP_BOOLAND = 0x9a;
export const OP_BOOLOR = 0x9b;
export const OP_NUMEQUAL = 0x9c;
export const OP_NUMEQUALVERIFY = 0x9d;
export const OP_NUMNOTEQUAL = 0x9e;
export const OP_LESSTHAN = 0x9f;
export const OP_GREATERTHAN = 0xa0;
export const OP_LESSTHANOREQUAL = 0xa1;
export const OP_GREATERTHANOREQUAL = 0xa2;
export const OP_MIN = 0xa3;
export const OP_MAX = 0xa4;
export const OP_WITHIN = 0xa5;

// Crypto
export const OP_BLAKE2B = 0xa8;
export const OP_CHECKSIGVERIFY = 0xab;
export const OP_CHECKSIG = 0xac;
export const OP_CHECKSIGECDSA = 0xad;
export const OP_CHECKMULTISIG = 0xae;
export const OP_CHECKMULTISIGVERIFY = 0xaf;
export const OP_CHECKMULTISIGECDSA = 0xb0;

// Locktime
export const OP_CHECKLOCKTIMEVERIFY = 0xb1;
export const OP_CHECKSEQUENCEVERIFY = 0xb2;

// KIP-10 Covenant Opcodes (Testnet 12+ only)
// These enable introspection of transaction inputs/outputs
export const OP_INPUTSPKHASH = 0xc1;     // Hash of input script pubkey
export const OP_TXINPUTCOUNT = 0xc2;     // Number of transaction inputs
export const OP_TXOUTPUTCOUNT = 0xc3;    // Number of transaction outputs
export const OP_OUTPUTVALUE = 0xc4;      // Get output value at index
export const OP_OUTPUTSPKHASH = 0xc5;    // Get output script pubkey hash at index
export const OP_UTXOVALUE = 0xc6;        // Get UTXO value for input at index
export const OP_UTXOSPKHASH = 0xc7;      // Get UTXO script pubkey hash at index
export const OP_OUTPOINTTXHASH = 0xc8;   // Get outpoint tx hash for input
export const OP_OUTPOINTINDEX = 0xc9;    // Get outpoint index for input
export const OP_INPUTINDEX = 0xca;       // Current input index

/**
 * Check if network supports covenant opcodes
 */
export function supportsCovenants(network: 'mainnet' | 'testnet'): boolean {
  // As of Feb 2026, covenant opcodes are only active on Testnet 12
  return network === 'testnet';
}
