export interface ITransactionManager {
  runTransaction<T>(operation: (transaction: any) => Promise<T>): Promise<T>;
}
