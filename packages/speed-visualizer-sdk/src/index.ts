export type TxLifecycleStage = 'broadcasted' | 'accepted' | 'included' | 'confirmations';

export type TxLifecycleEvent = {
  txid: string;
  stage: TxLifecycleStage;
  atMs: number;
};

