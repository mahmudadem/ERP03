import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { PromotionRule } from '../../../domain/sales/entities/PromotionRule';
import {
  PromotionApplicationService,
  PromotionEvalLine,
} from '../../../application/sales/services/PromotionApplicationService';
import {
  EvaluatePromotionsUseCase,
} from '../../../application/sales/use-cases/PromotionUseCases';
import { IPromotionRuleRepository } from '../../../repository/interfaces/sales/IPromotionRuleRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-promo-test';
const TODAY = '2026-05-20';

// ---------------------------------------------------------------------------
// Helpers — entity factories
// ---------------------------------------------------------------------------

const makeBxgyRule = (
  overrides: Partial<ConstructorParameters<typeof PromotionRule>[0]> = {}
) =>
  new PromotionRule({
    companyId: COMPANY_ID,
    name: 'Buy 3 Get 1 Free',
    type: 'BUY_X_GET_Y',
    status: 'ACTIVE',
    scope: 'ALL',
    buyXGetY: { buyQty: 3, getQty: 1 },
    createdBy: 'u-test',
    ...overrides,
  });

const makeThresholdRule = (
  overrides: Partial<ConstructorParameters<typeof PromotionRule>[0]> = {}
) =>
  new PromotionRule({
    companyId: COMPANY_ID,
    name: '10% Off Over 100',
    type: 'THRESHOLD_DISCOUNT',
    status: 'ACTIVE',
    scope: 'ALL',
    thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 5, discountPct: 10 },
    createdBy: 'u-test',
    ...overrides,
  });

const makeLine = (overrides: Partial<PromotionEvalLine> = {}): PromotionEvalLine => ({
  lineId: 'l-1',
  itemId: 'item-1',
  qty: 1,
  unitPriceDoc: 100,
  lineAmountDoc: 100,
  hasManualDiscount: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers — mock repo
// ---------------------------------------------------------------------------

const makePromotionRepo = (
  overrides: Partial<IPromotionRuleRepository> = {}
): jest.Mocked<IPromotionRuleRepository> =>
  ({
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    list: jest.fn(async () => []),
    delete: jest.fn(async () => {}),
    ...overrides,
  } as jest.Mocked<IPromotionRuleRepository>);

// ---------------------------------------------------------------------------
// 1. PromotionRule constructor — BUY_X_GET_Y without config
// ---------------------------------------------------------------------------

describe('PromotionRule constructor validation', () => {
  it('1. rejects BUY_X_GET_Y without buyXGetY config', () => {
    expect(() =>
      new PromotionRule({
        companyId: COMPANY_ID,
        name: 'Bad rule',
        type: 'BUY_X_GET_Y',
        status: 'ACTIVE',
        scope: 'ALL',
        createdBy: 'u-test',
        // buyXGetY omitted
      })
    ).toThrow(/buyXGetY config is required/i);
  });

  it('2. rejects THRESHOLD_DISCOUNT with discountPct > 100', () => {
    expect(() =>
      new PromotionRule({
        companyId: COMPANY_ID,
        name: 'Bad discount',
        type: 'THRESHOLD_DISCOUNT',
        status: 'ACTIVE',
        scope: 'ALL',
        thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 5, discountPct: 101 },
        createdBy: 'u-test',
      })
    ).toThrow(/discountPct must be between 0 and 100/i);
  });

  it('3. rejects scope ITEMS with empty itemIds', () => {
    expect(() =>
      new PromotionRule({
        companyId: COMPANY_ID,
        name: 'Items rule',
        type: 'BUY_X_GET_Y',
        status: 'ACTIVE',
        scope: 'ITEMS',
        itemIds: [],   // empty — must throw
        buyXGetY: { buyQty: 2, getQty: 1 },
        createdBy: 'u-test',
      })
    ).toThrow(/itemIds must be non-empty/i);
  });
});

// ---------------------------------------------------------------------------
// 2. isActiveOn
// ---------------------------------------------------------------------------

describe('PromotionRule.isActiveOn', () => {
  it('4. returns false when status is INACTIVE', () => {
    const rule = makeBxgyRule({ status: 'INACTIVE' });
    expect(rule.isActiveOn(TODAY)).toBe(false);
  });

  it('5. returns false when date is before validFrom', () => {
    const rule = makeBxgyRule({ validFrom: '2026-06-01' });
    expect(rule.isActiveOn('2026-05-31')).toBe(false);
  });

  it('6. returns false when date is after validTo', () => {
    const rule = makeBxgyRule({ validTo: '2026-04-30' });
    expect(rule.isActiveOn(TODAY)).toBe(false);
  });

  it('7. returns true when ACTIVE and within window', () => {
    const rule = makeBxgyRule({ validFrom: '2026-01-01', validTo: '2026-12-31' });
    expect(rule.isActiveOn(TODAY)).toBe(true);
  });

  it('8. returns true when ACTIVE and no date window is set', () => {
    const rule = makeBxgyRule();
    expect(rule.isActiveOn(TODAY)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. appliesToItem
// ---------------------------------------------------------------------------

describe('PromotionRule.appliesToItem', () => {
  it('9. scope ALL → always true', () => {
    const rule = makeBxgyRule({ scope: 'ALL' });
    expect(rule.appliesToItem('any-item')).toBe(true);
    expect(rule.appliesToItem('any-item', 'any-cat')).toBe(true);
  });

  it('10. scope ITEMS → only listed items match', () => {
    const rule = makeBxgyRule({
      scope: 'ITEMS',
      itemIds: ['item-A', 'item-B'],
    });
    expect(rule.appliesToItem('item-A')).toBe(true);
    expect(rule.appliesToItem('item-C')).toBe(false);
  });

  it('11. scope CATEGORIES → matches by category, not item id', () => {
    const rule = makeBxgyRule({
      scope: 'CATEGORIES',
      itemIds: [],
      categoryIds: ['cat-X'],
    });
    expect(rule.appliesToItem('item-999', 'cat-X')).toBe(true);
    expect(rule.appliesToItem('item-999', 'cat-Y')).toBe(false);
    expect(rule.appliesToItem('item-999')).toBe(false); // no categoryId provided
  });
});

// ---------------------------------------------------------------------------
// 4. evaluate — BUY_X_GET_Y
// ---------------------------------------------------------------------------

describe('PromotionApplicationService — BUY_X_GET_Y', () => {
  const service = new PromotionApplicationService();

  it('12. buy 10, rule buy-3-get-1 → freeQty = 3 (floor(10/3)*1)', () => {
    const rule = makeBxgyRule({ buyXGetY: { buyQty: 3, getQty: 1 } });
    const line = makeLine({ qty: 10 });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.freeGoods).toHaveLength(1);
    expect(result.freeGoods[0].qty).toBe(3);
    expect(result.freeGoods[0].itemId).toBe(line.itemId); // same item (no getItemId)
    expect(result.freeGoods[0].sourceLineId).toBe(line.lineId);
  });

  it('13. getItemId set → free item is the specified cross-item', () => {
    const rule = makeBxgyRule({
      buyXGetY: { buyQty: 2, getQty: 1, getItemId: 'free-item-99' },
    });
    const line = makeLine({ qty: 4 });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.freeGoods).toHaveLength(1);
    expect(result.freeGoods[0].itemId).toBe('free-item-99');
    expect(result.freeGoods[0].qty).toBe(2); // floor(4/2)*1
  });

  it('14. qty below buyQty → no free goods', () => {
    const rule = makeBxgyRule({ buyXGetY: { buyQty: 5, getQty: 1 } });
    const line = makeLine({ qty: 3 });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.freeGoods).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. evaluate — THRESHOLD_DISCOUNT
// ---------------------------------------------------------------------------

describe('PromotionApplicationService — THRESHOLD_DISCOUNT', () => {
  const service = new PromotionApplicationService();

  it('15. THRESHOLD_DISCOUNT by QTY: qty meets threshold → discount suggested', () => {
    const rule = makeThresholdRule({
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 5, discountPct: 15 },
    });
    const line = makeLine({ qty: 5 });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.lineDiscounts).toHaveLength(1);
    expect(result.lineDiscounts[0].discountPct).toBe(15);
    expect(result.lineDiscounts[0].lineId).toBe(line.lineId);
  });

  it('16. THRESHOLD_DISCOUNT by AMOUNT: lineAmount meets threshold → discount suggested', () => {
    const rule = makeThresholdRule({
      thresholdDiscount: { thresholdBasis: 'AMOUNT', thresholdValue: 500, discountPct: 5 },
    });
    const line = makeLine({ qty: 2, lineAmountDoc: 600 });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.lineDiscounts).toHaveLength(1);
    expect(result.lineDiscounts[0].discountPct).toBe(5);
  });

  it('17. manual-discount precedence: hasManualDiscount=true → no threshold discount', () => {
    const rule = makeThresholdRule({
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 20 },
    });
    const line = makeLine({ qty: 10, hasManualDiscount: true });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.lineDiscounts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. evaluate — inactive rule produces nothing
// ---------------------------------------------------------------------------

describe('PromotionApplicationService — inactive rules', () => {
  const service = new PromotionApplicationService();

  it('18. an INACTIVE rule produces no suggestions', () => {
    const rule = makeBxgyRule({ status: 'INACTIVE' });
    const line = makeLine({ qty: 10 });
    const result = service.evaluate([line], [rule], TODAY);
    expect(result.freeGoods).toHaveLength(0);
    expect(result.lineDiscounts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. evaluate — two matching threshold rules, only lower-priority fires
// ---------------------------------------------------------------------------

describe('PromotionApplicationService — priority ordering', () => {
  const service = new PromotionApplicationService();

  it('19. with two matching THRESHOLD rules, only the lower-priority-number one is applied', () => {
    // priority 1 fires first, priority 2 is skipped
    const ruleP1 = makeThresholdRule({
      name: 'Rule priority 1',
      priority: 1,
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 10 },
    });
    const ruleP2 = makeThresholdRule({
      name: 'Rule priority 2',
      priority: 2,
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 1, discountPct: 20 },
    });

    const line = makeLine({ qty: 5 });
    // Pass in reverse order to confirm sorting is applied
    const result = service.evaluate([line], [ruleP2, ruleP1], TODAY);
    expect(result.lineDiscounts).toHaveLength(1);
    expect(result.lineDiscounts[0].ruleName).toBe('Rule priority 1');
    expect(result.lineDiscounts[0].discountPct).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 8. evaluate — a line can receive both free goods AND a discount
// ---------------------------------------------------------------------------

describe('PromotionApplicationService — combined mechanics', () => {
  const service = new PromotionApplicationService();

  it('20. a line may receive both a free-goods and a discount suggestion', () => {
    const bxgyRule = makeBxgyRule({ priority: 0, buyXGetY: { buyQty: 2, getQty: 1 } });
    const threshRule = makeThresholdRule({
      priority: 1,
      thresholdDiscount: { thresholdBasis: 'QTY', thresholdValue: 2, discountPct: 5 },
    });
    const line = makeLine({ qty: 4 });
    const result = service.evaluate([line], [bxgyRule, threshRule], TODAY);
    expect(result.freeGoods).toHaveLength(1);
    expect(result.lineDiscounts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 9. EvaluatePromotionsUseCase — loads rules from mocked repo
// ---------------------------------------------------------------------------

describe('EvaluatePromotionsUseCase', () => {
  it('21. loads rules from repo and returns combined evaluation result', async () => {
    const rule = makeBxgyRule({ buyXGetY: { buyQty: 3, getQty: 1 } });

    const repo = makePromotionRepo({
      list: jest.fn(async () => [rule]),
    });

    const uc = new EvaluatePromotionsUseCase(repo);
    const result = await uc.execute({
      companyId: COMPANY_ID,
      lines: [makeLine({ qty: 9 })],
      asOfDate: TODAY,
    });

    expect(repo.list).toHaveBeenCalledWith(COMPANY_ID);
    expect(result.freeGoods).toHaveLength(1);
    expect(result.freeGoods[0].qty).toBe(3); // floor(9/3)*1 = 3
  });

  it('22. defaults asOfDate to today when not provided', async () => {
    const repo = makePromotionRepo();
    const uc = new EvaluatePromotionsUseCase(repo);
    // Should not throw; just verifying the default date path executes
    const result = await uc.execute({ companyId: COMPANY_ID, lines: [] });
    expect(result.freeGoods).toHaveLength(0);
    expect(result.lineDiscounts).toHaveLength(0);
  });
});
