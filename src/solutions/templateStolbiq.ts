import type {
  API,
  FinalizedEvent,
  IncomingEvent,
  NewBlockEvent,
  NewTransactionEvent,
  OutputAPI,
  Settled,
} from "../types"

export default function yourGhHandle(api: API, outputApi: OutputAPI) {

  let settledBlockMap = new Map<string, [string, Settled][]>(); // Map<blockHash, Map<tx, SettledState>>
  let ongoingTransactions: string[] = [];

  // Requirements:
  //
  // 1) When a transaction becomes "settled"-which always occurs upon receiving a "newBlock" event-
  //    you must call `outputApi.onTxSettled`.
  //
  //    - Multiple transactions may settle in the same block, so `onTxSettled` could be called
  //      multiple times per "newBlock" event.
  //    - Ensure callbacks are invoked in the same order as the transactions originally arrived.
  //
  // 2) When a transaction becomes "done"-meaning the block it was settled in gets finalized-
  //    you must call `outputApi.onTxDone`.
  //
  //    - Multiple transactions may complete upon a single "finalized" event.
  //    - As above, maintain the original arrival order when invoking `onTxDone`.
  //    - Keep in mind that the "finalized" event is not emitted for all finalized blocks.
  //
  // Notes:
  // - It is **not** ok to make redundant calls to either `onTxSettled` or `onTxDone`.
  // - It is ok to make redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`
  //
  // Bonus 1:
  // - Avoid making redundant calls to `getBody`, `isTxValid` and `isTxSuccessful`.
  //
  // Bonus 2:
  // - Upon receiving a "finalized" event, call `api.unpin` to unpin blocks that are either:
  //     a) pruned, or
  //     b) older than the currently finalized block.

  const onNewBlock = ({ blockHash, parent }: NewBlockEvent) => {
    // TODO:: implement it
    if (settledBlockMap.has(parent)) return

    const txBody = api.getBody(blockHash);

    ongoingTransactions.forEach(tx => {

      if (!txBody.includes(tx)) {
        
        if (api.isTxValid(blockHash, tx)) return

        const txState = settledBlockMap.get(blockHash) ?? [];
        const settledState = { blockHash: blockHash, type: "invalid" } as Settled;
        txState.push([tx, settledState]);
        settledBlockMap.set(blockHash, txState);
        outputApi.onTxSettled(tx, settledState);

      } else {

        const settledState = (api.isTxValid(blockHash, tx) ? {
          blockHash: blockHash,
          type: "valid",
          successful: api.isTxSuccessful(blockHash, tx)
        } : { blockHash: blockHash, type: "invalid" }) as Settled;

        const txState = settledBlockMap.get(blockHash) ?? [];
        txState.push([tx, settledState]);
        settledBlockMap.set(blockHash, txState);
        outputApi.onTxSettled(tx, settledState);
      }

    });
  }

  const onNewTx = ({ value: transaction }: NewTransactionEvent) => {
    // TODO:: implement it
    ongoingTransactions.push(transaction);
  }

  const onFinalized = ({ blockHash }: FinalizedEvent) => {
    // TODO:: implement it
    if (settledBlockMap.has(blockHash)) {
      const txArray = settledBlockMap.get(blockHash);

      if (txArray) {
        txArray.forEach(value => {
          outputApi.onTxDone(value[0], value[1]);
        })
      }
    }
  }

  return (event: IncomingEvent) => {

    switch (event.type) {
      case "newBlock": {
        onNewBlock(event)
        break
      }
      case "newTransaction": {
        onNewTx(event)
        break
      }
      case "finalized":
        onFinalized(event)
    }
  }
}
