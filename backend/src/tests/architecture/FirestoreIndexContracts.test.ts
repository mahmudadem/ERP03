import fs from 'fs';
import path from 'path';

type IndexField = {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
};

type CompositeIndex = {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: IndexField[];
};

const rootIndexPath = path.resolve(__dirname, '../../../../firestore.indexes.json');

const fieldSignature = (fields: IndexField[]) =>
  fields.map(({ fieldPath, order, arrayConfig }) => ({
    fieldPath,
    order,
    arrayConfig
  }));

const ledgerIndexCases: Array<[string, IndexField[]]> = [
  [
    'posted account statements',
    [
      { fieldPath: 'accountId', order: 'ASCENDING' },
      { fieldPath: 'isPosted', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'ASCENDING' }
    ]
  ],
  [
    'account statements including unposted entries',
    [
      { fieldPath: 'accountId', order: 'ASCENDING' },
      { fieldPath: 'date', order: 'ASCENDING' }
    ]
  ]
];

describe('Firestore production index contracts', () => {
  const config = JSON.parse(fs.readFileSync(rootIndexPath, 'utf8')) as {
    indexes: CompositeIndex[];
  };

  it.each(ledgerIndexCases)('defines the ledger index required by %s', (_label, expectedFields) => {
    expect(config.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionGroup: 'ledger',
          queryScope: 'COLLECTION',
          fields: fieldSignature(expectedFields)
        })
      ])
    );
  });

  it('defines the Purchase dashboard and analytics invoice index', () => {
    expect(config.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionGroup: 'purchase_invoices',
          queryScope: 'COLLECTION',
          fields: fieldSignature([
            { fieldPath: 'status', order: 'ASCENDING' },
            { fieldPath: 'invoiceDate', order: 'DESCENDING' },
            { fieldPath: '__name__', order: 'DESCENDING' }
          ])
        })
      ])
    );
  });

  it('defines the Sales dashboard invoice index with Firestore document-name tiebreaker', () => {
    expect(config.indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collectionGroup: 'sales_invoices',
          queryScope: 'COLLECTION',
          fields: fieldSignature([
            { fieldPath: 'status', order: 'ASCENDING' },
            { fieldPath: 'invoiceDate', order: 'DESCENDING' },
            { fieldPath: '__name__', order: 'DESCENDING' }
          ])
        })
      ])
    );
  });
});
