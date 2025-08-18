import { describe, it, expect, beforeEach } from 'vitest';
import { SAFEService } from './safe-service.js';
import { FileModel } from '../model.js';

describe('SAFEService', () => {
  let model: FileModel;
  let service: SAFEService;
  const aliceId = 'sh_alice';
  const bobId = 'sh_bob';

  beforeEach(() => {
    model = {
      version: 1,
      company: {
        id: 'comp_123',
        name: 'Test Corp',
        formationDate: '2024-01-01',
      },
      stakeholders: [
        { id: aliceId, type: 'person', name: 'Alice Investor' },
        { id: bobId, type: 'person', name: 'Bob Angel' },
      ],
      securityClasses: [
        { id: 'sc_common', kind: 'COMMON', label: 'Common Stock', authorized: 10000000, parValue: 0.0001 },
      ],
      issuances: [
        { id: 'is_1', securityClassId: 'sc_common', stakeholderId: 'sh_founder', qty: 5000000, pps: 0.0001, date: '2024-01-01' },
      ],
      optionGrants: [],
      safes: [],
      valuations: [],
      audit: [],
    };
    service = new SAFEService(model);
  });

  describe('addSAFE', () => {
    it('should add a SAFE with all parameters', () => {
      const safe = service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 5000000,
        discount: 0.8,
        type: 'post',
        note: 'YC SAFE',
        date: '2024-03-01',
      });

      expect(safe.stakeholderId).toBe(aliceId);
      expect(safe.amount).toBe(100000);
      expect(safe.cap).toBe(5000000);
      expect(safe.discount).toBe(0.8);
      expect(safe.type).toBe('post');
      expect(safe.note).toBe('YC SAFE');
      expect(safe.date).toBe('2024-03-01');
      expect(safe.id).toMatch(/^safe_/);
      expect(model.safes).toHaveLength(1);
    });

    it('should add a SAFE with minimal parameters', () => {
      const safe = service.addSAFE({
        stakeholderId: bobId,
        amount: 50000,
      });

      expect(safe.stakeholderId).toBe(bobId);
      expect(safe.amount).toBe(50000);
      expect(safe.cap).toBeUndefined();
      expect(safe.discount).toBeUndefined();
      expect(safe.type).toBeUndefined();
      expect(safe.date).toBeDefined();
    });

    it('should throw for invalid stakeholder', () => {
      expect(() => {
        service.addSAFE({
          stakeholderId: 'invalid',
          amount: 100000,
        });
      }).toThrow('Stakeholder with ID "invalid" not found');
    });

    it('should throw for invalid discount', () => {
      expect(() => {
        service.addSAFE({
          stakeholderId: aliceId,
          amount: 100000,
          discount: 1.5,
        });
      }).toThrow('Discount must be between 0 and 1');
    });

    it('should throw for negative amount', () => {
      expect(() => {
        service.addSAFE({
          stakeholderId: aliceId,
          amount: -100000,
        });
      }).toThrow();
    });
  });

  describe('getSAFE', () => {
    it('should return SAFE by ID', () => {
      const added = service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
      });

      const safe = service.getSAFE(added.id);
      expect(safe).toEqual(added);
    });

    it('should return undefined for non-existent ID', () => {
      const safe = service.getSAFE('invalid');
      expect(safe).toBeUndefined();
    });
  });

  describe('listSAFEs', () => {
    it('should return all SAFEs', () => {
      service.addSAFE({ stakeholderId: aliceId, amount: 100000 });
      service.addSAFE({ stakeholderId: bobId, amount: 50000 });

      const safes = service.listSAFEs();
      expect(safes).toHaveLength(2);
      expect(safes[0].amount).toBe(100000);
      expect(safes[1].amount).toBe(50000);
    });

    it('should return empty array when no SAFEs', () => {
      const safes = service.listSAFEs();
      expect(safes).toEqual([]);
    });
  });

  describe('getSAFEsByStakeholder', () => {
    it('should return SAFEs for a specific stakeholder', () => {
      service.addSAFE({ stakeholderId: aliceId, amount: 100000 });
      service.addSAFE({ stakeholderId: aliceId, amount: 50000 });
      service.addSAFE({ stakeholderId: bobId, amount: 25000 });

      const aliceSafes = service.getSAFEsByStakeholder(aliceId);
      expect(aliceSafes).toHaveLength(2);
      expect(aliceSafes[0].amount + aliceSafes[1].amount).toBe(150000);
    });
  });

  describe('getTotalSAFEAmount', () => {
    it('should calculate total SAFE investments', () => {
      service.addSAFE({ stakeholderId: aliceId, amount: 100000 });
      service.addSAFE({ stakeholderId: bobId, amount: 50000 });
      service.addSAFE({ stakeholderId: aliceId, amount: 25000 });

      expect(service.getTotalSAFEAmount()).toBe(175000);
    });

    it('should return 0 when no SAFEs', () => {
      expect(service.getTotalSAFEAmount()).toBe(0);
    });
  });

  describe('removeSAFE', () => {
    it('should remove a SAFE by ID', () => {
      const safe = service.addSAFE({ stakeholderId: aliceId, amount: 100000 });
      expect(model.safes).toHaveLength(1);

      service.removeSAFE(safe.id);
      expect(model.safes).toHaveLength(0);
    });

    it('should throw for non-existent SAFE', () => {
      expect(() => {
        service.removeSAFE('invalid');
      }).toThrow('SAFE with ID "invalid" not found');
    });
  });

  describe('simulateConversion', () => {
    it('should simulate conversion with cap', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 4000000,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2000000,
        pricePerShare: 2.0,
      });

      expect(conversions).toHaveLength(1);
      const conv = conversions[0];
      expect(conv.stakeholderName).toBe('Alice Investor');
      expect(conv.investmentAmount).toBe(100000);
      expect(conv.conversionPrice).toBe(0.8); // cap price: 4M / 5M shares
      expect(conv.sharesIssued).toBe(125000); // 100k / 0.8
      expect(conv.conversionReason).toBe('cap');
    });

    it('should simulate conversion with discount', () => {
      service.addSAFE({
        stakeholderId: bobId,
        amount: 50000,
        discount: 0.8, // 20% discount
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2000000,
        pricePerShare: 2.0,
      });

      expect(conversions).toHaveLength(1);
      const conv = conversions[0];
      expect(conv.conversionPrice).toBe(1.6); // 2.0 * 0.8
      expect(conv.sharesIssued).toBe(31250); // 50k / 1.6
      expect(conv.conversionReason).toBe('discount');
    });

    it('should use lowest price between cap and discount', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 5000000,
        discount: 0.9,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2000000,
        pricePerShare: 2.0,
      });

      const conv = conversions[0];
      // Cap price: 5M / 5M = 1.0
      // Discount price: 2.0 * 0.9 = 1.8
      // Should use cap price (lower)
      expect(conv.conversionPrice).toBe(1.0);
      expect(conv.conversionReason).toBe('cap');
    });
  });

  describe('getSAFEsSummary', () => {
    it('should provide summary by stakeholder', () => {
      service.addSAFE({ stakeholderId: aliceId, amount: 100000 });
      service.addSAFE({ stakeholderId: aliceId, amount: 50000 });
      service.addSAFE({ stakeholderId: bobId, amount: 25000 });

      const summary = service.getSAFEsSummary();
      
      expect(summary.count).toBe(3);
      expect(summary.totalAmount).toBe(175000);
      expect(summary.byStakeholder).toHaveLength(2);
      
      const alice = summary.byStakeholder.find(s => s.stakeholderId === aliceId);
      expect(alice?.stakeholderName).toBe('Alice Investor');
      expect(alice?.amount).toBe(150000);
      expect(alice?.safes).toHaveLength(2);
    });
  });

  describe('simulateConversion - edge cases', () => {
    it('should handle SAFE with only cap (no discount)', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 3000000,
        // No discount
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2000000,
        pricePerShare: 2.0,
      });

      const conv = conversions[0];
      expect(conv.conversionPrice).toBe(0.6); // 3M cap / 5M shares
      expect(conv.sharesIssued).toBe(166666); // 100k / 0.6
      expect(conv.conversionReason).toBe('cap');
    });

    it('should handle SAFE with only discount (no cap)', () => {
      service.addSAFE({
        stakeholderId: bobId,
        amount: 75000,
        discount: 0.75, // 25% discount
        // No cap
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 8000000,
        newMoneyRaised: 2000000,
        pricePerShare: 1.6,
      });

      const conv = conversions[0];
      expect(conv.conversionPrice).toBeCloseTo(1.2, 10); // 1.6 * 0.75
      // Due to floating point precision, 75000 / 1.2000000000000002 = 62499.99... rounds to 62499
      expect(conv.sharesIssued).toBe(62499);
      expect(conv.conversionReason).toBe('discount');
    });

    it('should handle multiple SAFEs with different terms', () => {
      // Add multiple SAFEs with varying terms
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 4000000,
        discount: 0.8,
      });
      
      service.addSAFE({
        stakeholderId: bobId,
        amount: 50000,
        discount: 0.7,
      });
      
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 75000,
        cap: 3000000,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 3000000,
        pricePerShare: 2.0,
      });

      expect(conversions).toHaveLength(3);
      
      // First SAFE: cap vs discount
      const conv1 = conversions[0];
      expect(conv1.conversionPrice).toBe(0.8); // Cap price wins (4M/5M = 0.8 < 2.0*0.8 = 1.6)
      expect(conv1.conversionReason).toBe('cap');
      
      // Second SAFE: discount only
      const conv2 = conversions[1];
      expect(conv2.conversionPrice).toBe(1.4); // 2.0 * 0.7
      expect(conv2.conversionReason).toBe('discount');
      
      // Third SAFE: cap only
      const conv3 = conversions[2];
      expect(conv3.conversionPrice).toBe(0.6); // 3M / 5M
      expect(conv3.conversionReason).toBe('cap');
    });

    it('should handle conversion at exactly the cap valuation', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 5000000,
        discount: 0.8,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 5000000, // Same as cap
        newMoneyRaised: 1000000,
        pricePerShare: 1.0,
      });

      const conv = conversions[0];
      // At cap: both prices are same
      // Cap price: 5M / 5M = 1.0
      // Discount price: 1.0 * 0.8 = 0.8
      // Discount is better
      expect(conv.conversionPrice).toBe(0.8);
      expect(conv.conversionReason).toBe('discount');
    });

    it('should handle post-money SAFE conversion', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 6000000,
        type: 'post',
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2000000,
        pricePerShare: 2.0,
      });

      const conv = conversions[0];
      // Post-money cap calculation is different
      // Approximation: 6M / (5M + shares from this SAFE)
      expect(conv.conversionReason).toBe('cap');
      expect(conv.sharesIssued).toBeGreaterThan(0);
    });

    it('should handle zero-price edge case gracefully', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 100000,
        cap: 5000000,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 0, // Edge case
        newMoneyRaised: 1000000,
      });

      // Should not crash, but handle gracefully
      expect(conversions).toHaveLength(1);
      expect(conversions[0].sharesIssued).toBeGreaterThan(0);
    });

    it('should handle very large investment amounts', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 10000000, // $10M SAFE
        cap: 50000000,
        discount: 0.8,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 100000000,
        newMoneyRaised: 20000000,
        pricePerShare: 20.0,
      });

      const conv = conversions[0];
      expect(conv.investmentAmount).toBe(10000000);
      expect(conv.sharesIssued).toBeGreaterThan(0);
      expect(conv.sharesIssued).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    it('should handle SAFE with no cap and no discount at round price', () => {
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 50000,
        // No cap, no discount - converts at round price
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2000000,
        pricePerShare: 2.0,
      });

      const conv = conversions[0];
      expect(conv.conversionPrice).toBe(2.0); // Round price
      expect(conv.sharesIssued).toBe(25000); // 50k / 2.0
      expect(conv.conversionReason).toBe('price');
    });

    it('should calculate correct shares when pre-money shares is low', () => {
      // Simulate early stage with few shares
      model.issuances[0].qty = 100000; // Only 100k shares issued
      
      service.addSAFE({
        stakeholderId: aliceId,
        amount: 50000,
        cap: 500000,
      });

      const conversions = service.simulateConversion({
        preMoneyValuation: 1000000,
        newMoneyRaised: 200000,
        pricePerShare: 10.0,
      });

      const conv = conversions[0];
      expect(conv.conversionPrice).toBe(5.0); // 500k cap / 100k shares
      expect(conv.sharesIssued).toBe(10000); // 50k / 5.0
      expect(conv.conversionReason).toBe('cap');
    });
  });
});