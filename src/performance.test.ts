import { describe, it, expect } from 'vitest';
import {
  FileModel,
  calcCap,
  vestedQty,
  convertSAFE,
  monthsBetween,
  parseUTCDate,
  formatUTCDate,
  Vesting,
  SAFE,
} from './model.js';
import { StakeholderService } from './services/stakeholder-service.js';
import { SecurityService } from './services/security-service.js';
import { EquityService } from './services/equity-service.js';
import { SAFEService } from './services/safe-service.js';

describe('Performance and Stress Tests', () => {
  describe('Large-scale cap table calculations', () => {
    it('should handle 10,000 transactions efficiently', { timeout: 60000 }, () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'perf_test', name: 'Performance Test Corp' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const stakeholderService = new StakeholderService(model);
      const securityService = new SecurityService(model);
      const equityService = new EquityService(model);
      const safeService = new SAFEService(model);

      // Setup security classes
      const common = securityService.addSecurityClass('COMMON', 'Common', 1000000000);
      const preferred = securityService.addSecurityClass('PREF', 'Preferred', 500000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Options', 200000000);

      const startSetup = performance.now();

      // Create 1000 stakeholders
      const stakeholders: string[] = [];
      for (let i = 0; i < 1000; i++) {
        const sh = stakeholderService.addStakeholder(
          `Stakeholder ${i}`,
          i % 2 === 0 ? 'person' : 'entity'
        );
        stakeholders.push(sh.id);
      }

      // Create 3000 share issuances
      for (let i = 0; i < 3000; i++) {
        const stakeholderId = stakeholders[i % stakeholders.length];
        const classId = i % 3 === 0 ? common.id : preferred.id;
        const shares = Math.floor(Math.random() * 10000) + 1000;
        equityService.issueShares(
          classId,
          stakeholderId,
          shares,
          0.01 * ((i % 10) + 1),
          '2020-01-01'
        );
      }

      // Create 3000 option grants with vesting
      for (let i = 0; i < 3000; i++) {
        const stakeholderId = stakeholders[i % stakeholders.length];
        const options = Math.floor(Math.random() * 5000) + 500;
        const vesting: Vesting = {
          start: `2020-${String((i % 12) + 1).padStart(2, '0')}-01`,
          monthsTotal: 48,
          cliffMonths: 12,
        };
        equityService.grantOptions(
          stakeholderId,
          options,
          0.5 * ((i % 5) + 1),
          '2020-01-01',
          vesting
        );
      }

      // Create 1000 SAFEs
      for (let i = 0; i < 1000; i++) {
        const stakeholderId = stakeholders[i % stakeholders.length];
        safeService.addSAFE({
          stakeholderId,
          amount: Math.floor(Math.random() * 100000) + 10000,
          cap: Math.floor(Math.random() * 10000000) + 1000000,
          discount: 0.7 + Math.random() * 0.25,
          date: '2021-01-01',
        });
      }

      const setupTime = performance.now() - startSetup;
      console.log(`Setup time for 10,000 transactions: ${setupTime.toFixed(2)}ms`);

      // Test cap table calculation performance
      const startCalc = performance.now();
      const capTable = calcCap(model, '2024-01-01');
      const calcTime = performance.now() - startCalc;

      console.log(`Cap table calculation time: ${calcTime.toFixed(2)}ms`);

      // Verify results
      expect(capTable.rows.length).toBeGreaterThan(0);
      expect(capTable.totals.issuedTotal).toBeGreaterThan(0);
      expect(calcTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test SAFE conversion performance
      const startConversion = performance.now();
      const conversions = safeService.simulateConversion({
        preMoneyValuation: 50000000,
        newMoneyRaised: 10000000,
        pricePerShare: 5.0,
      });
      const conversionTime = performance.now() - startConversion;

      console.log(`SAFE conversion time for 1000 SAFEs: ${conversionTime.toFixed(2)}ms`);

      expect(conversions.length).toBe(1000);
      expect(conversionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle extreme vesting calculations', { timeout: 10000 }, () => {
      const startTime = performance.now();

      // Test with 100-year vesting period
      const extremeVesting: Vesting = {
        start: '1920-01-01',
        monthsTotal: 1200, // 100 years
        cliffMonths: 120, // 10 year cliff
      };

      const testDates = [];
      for (let year = 1920; year <= 2020; year += 5) {
        testDates.push(`${year}-01-01`);
      }

      const results = testDates.map((date) => vestedQty(date, 1000000, extremeVesting));

      const calcTime = performance.now() - startTime;
      console.log(`100-year vesting calculation time: ${calcTime.toFixed(2)}ms`);

      // Verify monotonic increase
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
      }

      expect(calcTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle date calculations across centuries efficiently', { timeout: 10000 }, () => {
      const startTime = performance.now();
      const datePairs: Array<[string, string]> = [];

      // Generate date pairs across different centuries
      for (let year1 = 1900; year1 <= 2100; year1 += 20) {
        for (let year2 = 1900; year2 <= 2100; year2 += 20) {
          datePairs.push([
            `${year1}-${String((year1 % 12) + 1).padStart(2, '0')}-${String((year1 % 28) + 1).padStart(2, '0')}`,
            `${year2}-${String((year2 % 12) + 1).padStart(2, '0')}-${String((year2 % 28) + 1).padStart(2, '0')}`,
          ]);
        }
      }

      // Calculate months between all pairs
      const results = datePairs.map(([d1, d2]) => monthsBetween(d1, d2));

      const calcTime = performance.now() - startTime;
      console.log(
        `Cross-century date calculations (${datePairs.length} pairs): ${calcTime.toFixed(2)}ms`
      );

      expect(results.every((r) => r >= 0)).toBe(true);
      expect(calcTime).toBeLessThan(500);
    });
  });

  describe('Memory efficiency tests', () => {
    it(
      'should handle large number of stakeholders without memory issues',
      { timeout: 30000 },
      () => {
        const model: FileModel = {
          version: 1,
          company: { id: 'mem_test', name: 'Memory Test Corp' },
          stakeholders: [],
          securityClasses: [],
          issuances: [],
          optionGrants: [],
          safes: [],
          valuations: [],
          audit: [],
        };

        const stakeholderService = new StakeholderService(model);
        const initialMemory = process.memoryUsage().heapUsed;

        // Create 10,000 stakeholders
        for (let i = 0; i < 10000; i++) {
          stakeholderService.addStakeholder(`Person ${i}`, 'person', `person${i}@example.com`);
        }

        const afterStakeholders = process.memoryUsage().heapUsed;
        const memoryIncrease = (afterStakeholders - initialMemory) / 1024 / 1024; // Convert to MB

        console.log(`Memory used for 10,000 stakeholders: ${memoryIncrease.toFixed(2)} MB`);

        expect(model.stakeholders.length).toBe(10000);
        expect(memoryIncrease).toBeLessThan(100); // Should use less than 100MB
      }
    );

    it('should handle 50,000+ stakeholders efficiently', { timeout: 120000 }, () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'test', name: 'Test Corp' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const stakeholderService = new StakeholderService(model);

      const startTime = performance.now();
      for (let i = 0; i < 50000; i++) {
        stakeholderService.addStakeholder(`Stakeholder ${i}`, 'person');
      }
      const endTime = performance.now();

      expect(model.stakeholders.length).toBe(50000);

      expect(endTime - startTime).toBeLessThan(120000);

      const found = model.stakeholders.find((sh) => sh.name === 'Stakeholder 25000');
      expect(found).toBeDefined();
    });
  });

  describe('Concurrent operations stress test', () => {
    it('should handle rapid sequential calculations', { timeout: 30000 }, () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'concurrent', name: 'Concurrent Corp' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const stakeholderService = new StakeholderService(model);
      const securityService = new SecurityService(model);
      const equityService = new EquityService(model);

      // Setup
      const common = securityService.addSecurityClass('COMMON', 'Common', 10000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Options', 1000000); // Add option pool

      for (let i = 0; i < 100; i++) {
        const sh = stakeholderService.addStakeholder(`Person ${i}`, 'person');
        equityService.issueShares(common.id, sh.id, 10000, 0.01, '2020-01-01');

        if (i % 2 === 0) {
          equityService.grantOptions(sh.id, 5000, 0.5, '2020-01-01', {
            start: '2020-01-01',
            monthsTotal: 48,
            cliffMonths: 12,
          });
        }
      }

      const startTime = performance.now();
      const results = [];

      // Perform 1000 cap table calculations at different dates
      for (let i = 0; i < 1000; i++) {
        const year = 2020 + Math.floor(i / 100);
        const month = (i % 12) + 1;
        const date = `${year}-${String(month).padStart(2, '0')}-01`;
        results.push(calcCap(model, date));
      }

      const totalTime = performance.now() - startTime;
      console.log(`1000 cap table calculations: ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per calculation: ${(totalTime / 1000).toFixed(2)}ms`);

      expect(results.length).toBe(1000);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Edge case performance', () => {
    it('should handle SAFEs with extreme values efficiently', { timeout: 10000 }, () => {
      const extremeCases: SAFE[] = [
        {
          id: 'tiny',
          stakeholderId: 'sh_1',
          amount: 0.01,
          date: '2024-01-01',
          cap: 0.01,
          discount: 0.001,
        },
        {
          id: 'huge',
          stakeholderId: 'sh_2',
          amount: Number.MAX_SAFE_INTEGER / 2,
          date: '2024-01-01',
          cap: Number.MAX_SAFE_INTEGER,
          discount: 0.999999,
        },
        {
          id: 'precise',
          stakeholderId: 'sh_3',
          amount: Math.PI * 1000000,
          date: '2024-01-01',
          cap: Math.E * 1000000,
          discount: Math.SQRT2 / 2,
        },
      ];

      const startTime = performance.now();
      const results = [];

      // Test conversion with various price points
      for (const safe of extremeCases) {
        for (let price = 0.0001; price <= 10000; price *= 10) {
          for (let shares = 1000; shares <= 10000000; shares *= 100) {
            results.push(convertSAFE(safe, price, shares));
          }
        }
      }

      const calcTime = performance.now() - startTime;
      console.log(
        `Extreme SAFE conversions (${results.length} calculations): ${calcTime.toFixed(2)}ms`
      );

      // Verify all results are valid
      results.forEach((result) => {
        expect(Number.isFinite(result.sharesIssued)).toBe(true);
        expect(Number.isFinite(result.conversionPrice)).toBe(true);
        expect(result.sharesIssued).toBeGreaterThanOrEqual(0);
      });

      expect(calcTime).toBeLessThan(1000);
    });

    it('should handle sparse data efficiently', { timeout: 30000 }, () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'sparse', name: 'Sparse Corp' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const stakeholderService = new StakeholderService(model);
      const securityService = new SecurityService(model);
      const equityService = new EquityService(model);

      // Create many stakeholders but few transactions
      for (let i = 0; i < 5000; i++) {
        stakeholderService.addStakeholder(`Person ${i}`, 'person');
      }

      const common = securityService.addSecurityClass('COMMON', 'Common', 10000000);

      // Only issue to first 10 stakeholders
      for (let i = 0; i < 10; i++) {
        equityService.issueShares(common.id, model.stakeholders[i].id, 1000, 0.01, '2020-01-01');
      }

      const startTime = performance.now();
      const capTable = calcCap(model, '2024-01-01');
      const calcTime = performance.now() - startTime;

      console.log(
        `Sparse data cap table (5000 stakeholders, 10 with equity): ${calcTime.toFixed(2)}ms`
      );

      expect(capTable.rows.length).toBe(10);
      expect(calcTime).toBeLessThan(500); // Should be fast despite many stakeholders
    });
  });

  describe('Date parsing performance', () => {
    it('should parse and format dates efficiently', () => {
      const testDates = [];

      // Generate various date formats (only valid formats now)
      for (let year = 1900; year <= 2100; year += 10) {
        for (let month = 1; month <= 12; month++) {
          for (let day = 1; day <= 28; day += 7) {
            // Always use padded format for consistency
            testDates.push(
              `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            );
            testDates.push(
              `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`
            );
            testDates.push(
              `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`
            );
          }
        }
      }

      const startParse = performance.now();
      const parsed = testDates.map((d) => parseUTCDate(d));
      const parseTime = performance.now() - startParse;

      const startFormat = performance.now();
      const formatted = parsed.map((d) => formatUTCDate(d));
      const formatTime = performance.now() - startFormat;

      console.log(`Parsing ${testDates.length} dates: ${parseTime.toFixed(2)}ms`);
      console.log(`Formatting ${parsed.length} dates: ${formatTime.toFixed(2)}ms`);

      expect(parsed.every((d) => d instanceof Date && !isNaN(d.getTime()))).toBe(true);
      expect(formatted.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
      expect(parseTime).toBeLessThan(1000);
      expect(formatTime).toBeLessThan(1000);
    });
  });
});
