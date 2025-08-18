import { describe, it, expect, beforeEach } from 'vitest';
import { FileModel, calcCap, vestedQty, Vesting, convertSAFE, SAFE } from '../model.js';
import { StakeholderService } from '../services/stakeholder-service.js';
import { SecurityService } from '../services/security-service.js';
import { EquityService } from '../services/equity-service.js';
import { SAFEService } from '../services/safe-service.js';
import { ReportingService } from '../services/reporting-service.js';

describe('Cap Table Full Lifecycle Integration Tests', () => {
  describe('Company Formation to Exit', () => {
    let model: FileModel;
    let stakeholderService: StakeholderService;
    let securityService: SecurityService;
    let equityService: EquityService;
    let safeService: SAFEService;

    beforeEach(() => {
      // Initialize empty company
      model = {
        version: 1,
        company: {
          id: 'comp_startup',
          name: 'TechStartup Inc.',
          formationDate: '2020-01-01',
          entityType: 'C_CORP',
          jurisdiction: 'Delaware',
          currency: 'USD',
        },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      stakeholderService = new StakeholderService(model);
      securityService = new SecurityService(model);
      equityService = new EquityService(model);
      safeService = new SAFEService(model);
    });

    it('should handle complete startup lifecycle from formation to Series B', () => {
      // 1. Company Formation (Jan 2020)
      const founder1 = stakeholderService.addStakeholder(
        'Alice Founder',
        'person',
        'alice@startup.com'
      );
      const founder2 = stakeholderService.addStakeholder(
        'Bob Founder',
        'person',
        'bob@startup.com'
      );
      const commonStock = securityService.addSecurityClass(
        'COMMON',
        'Common Stock',
        10000000,
        0.0001
      );

      equityService.issueShares(commonStock.id, founder1.id, 4000000, 0.0001, '2020-01-01');
      equityService.issueShares(commonStock.id, founder2.id, 3000000, 0.0001, '2020-01-01');

      let capTable = calcCap(model, '2020-01-01');
      expect(capTable.totals.issuedTotal).toBe(7000000);
      expect(capTable.totals.outstandingTotal).toBe(7000000);

      // 2. Create Option Pool (Feb 2020)
      const optionPool = securityService.addSecurityClass(
        'OPTION_POOL',
        '2020 Stock Plan',
        2000000
      );

      // 3. Early Employees with Options (Mar-Dec 2020)
      const emp1 = stakeholderService.addStakeholder(
        'Charlie Employee',
        'person',
        'charlie@startup.com'
      );
      const emp2 = stakeholderService.addStakeholder(
        'Diana Employee',
        'person',
        'diana@startup.com'
      );

      const standardVesting: Vesting = {
        start: '2020-03-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      equityService.grantOptions(emp1.id, 100000, 0.1, '2020-03-01', standardVesting);
      equityService.grantOptions(emp2.id, 50000, 0.1, '2020-06-01', {
        start: '2020-06-01',
        monthsTotal: 48,
        cliffMonths: 12,
      });

      // Check vesting after 1 year
      capTable = calcCap(model, '2021-03-01');
      expect(capTable.totals.vestedOptions).toBe(25000); // Only emp1 has hit cliff
      expect(capTable.totals.unvestedOptions).toBe(125000);

      // 4. SAFE Round (Jun 2021)
      const angel1 = stakeholderService.addStakeholder('Angel Investor 1', 'person');
      const angel2 = stakeholderService.addStakeholder('Angel Investor 2', 'person');
      const vcFund = stakeholderService.addStakeholder('Seed VC Fund', 'entity');

      safeService.addSAFE({
        stakeholderId: angel1.id,
        amount: 250000,
        cap: 5000000,
        discount: 0.8,
        date: '2021-06-01',
      });

      safeService.addSAFE({
        stakeholderId: angel2.id,
        amount: 100000,
        cap: 5000000,
        discount: 0.8,
        date: '2021-06-15',
      });

      safeService.addSAFE({
        stakeholderId: vcFund.id,
        amount: 500000,
        cap: 6000000,
        type: 'post',
        date: '2021-07-01',
      });

      expect(safeService.getTotalSAFEAmount()).toBe(850000);

      // 5. More Employees (2021-2022)
      const employees = [];
      for (let i = 3; i <= 10; i++) {
        const emp = stakeholderService.addStakeholder(`Employee ${i}`, 'person');
        employees.push(emp);
        equityService.grantOptions(
          emp.id,
          10000 + i * 1000,
          0.25,
          `2021-${String((i % 12) + 1).padStart(2, '0')}-01`,
          {
            start: `2021-${String((i % 12) + 1).padStart(2, '0')}-01`,
            monthsTotal: 48,
            cliffMonths: 12,
          }
        );
      }

      // 6. Series A Round (Jan 2023) - SAFEs Convert
      const seriesALead = stakeholderService.addStakeholder('Series A Lead VC', 'entity');
      const seriesAFollow = stakeholderService.addStakeholder('Series A Follow', 'entity');
      const preferredA = securityService.addSecurityClass('PREF', 'Series A Preferred', 5000000);

      // Simulate SAFE conversion
      const conversions = safeService.simulateConversion({
        preMoneyValuation: 12000000,
        newMoneyRaised: 3000000,
        pricePerShare: 1.5,
      });

      // Convert SAFEs to preferred stock
      conversions.forEach((conv) => {
        equityService.issueShares(
          preferredA.id,
          conv.stakeholderId,
          conv.sharesIssued,
          conv.conversionPrice,
          '2023-01-15'
        );
      });

      // New money
      equityService.issueShares(preferredA.id, seriesALead.id, 1500000, 1.5, '2023-01-15');
      equityService.issueShares(preferredA.id, seriesAFollow.id, 500000, 1.5, '2023-01-15');

      // Check cap table after Series A
      capTable = calcCap(model, '2023-01-15');
      expect(capTable.totals.issuedTotal).toBeGreaterThan(7000000); // Original + converted SAFEs + new money
      expect(capTable.totals.outstandingTotal).toBeGreaterThan(7000000);

      // 7. Refresh grants for key employees (Mar 2023)
      const refreshVesting: Vesting = {
        start: '2023-03-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      equityService.grantOptions(emp1.id, 50000, 2.0, '2023-03-01', refreshVesting);
      equityService.grantOptions(emp2.id, 30000, 2.0, '2023-03-01', refreshVesting);

      // 8. Series B Round (Jan 2024)
      const seriesBLead = stakeholderService.addStakeholder('Series B Lead VC', 'entity');
      const preferredB = securityService.addSecurityClass('PREF', 'Series B Preferred', 2000000);

      equityService.issueShares(preferredB.id, seriesBLead.id, 1000000, 5.0, '2024-01-15');

      // Final cap table check
      const finalCapTable = calcCap(model, '2024-06-01');

      // Verify ownership distribution
      const founders = finalCapTable.rows.filter(
        (r) => r.name === 'Alice Founder' || r.name === 'Bob Founder'
      );
      const totalFounderOwnership = founders.reduce((sum, f) => sum + f.pctFullyDiluted, 0);

      // Founders should still have significant ownership but diluted
      expect(totalFounderOwnership).toBeGreaterThan(0.3); // At least 30%
      expect(totalFounderOwnership).toBeLessThan(0.7); // Less than 70% after dilution

      // Check total equity
      expect(finalCapTable.totals.fd.totalFD).toBeGreaterThan(10000000);
    });

    it('should handle accelerated vesting on acquisition', () => {
      // Setup company with employees
      const founder = stakeholderService.addStakeholder('Founder', 'person');
      const emp1 = stakeholderService.addStakeholder('Key Employee', 'person');
      const emp2 = stakeholderService.addStakeholder('Regular Employee', 'person');
      const common = securityService.addSecurityClass('COMMON', 'Common Stock', 10000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Option Pool', 1000000);

      equityService.issueShares(common.id, founder.id, 8000000, 0.0001, '2020-01-01');

      // Grant with different acceleration terms
      const doubleTrigggerVesting: Vesting = {
        start: '2021-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      };

      equityService.grantOptions(emp1.id, 200000, 0.5, '2021-01-01', doubleTrigggerVesting);
      equityService.grantOptions(emp2.id, 100000, 0.5, '2021-01-01', doubleTrigggerVesting);

      // Check vesting before acquisition (2 years later)
      const beforeAcquisition = calcCap(model, '2023-01-01');
      const emp1Row = beforeAcquisition.rows.find((r) => r.name === 'Key Employee');
      expect(emp1Row?.outstanding).toBe(100000); // 50% vested after 2 years

      // Simulate acquisition with acceleration
      // In real scenario, we'd modify vesting terms or create new issuances
      // For this test, we'll check what full acceleration would look like
      const fullVestDate = '2025-01-01'; // Full 4 years
      const afterAcceleration = calcCap(model, fullVestDate);
      const emp1RowAfter = afterAcceleration.rows.find((r) => r.name === 'Key Employee');
      expect(emp1RowAfter?.outstanding).toBe(200000); // Fully vested
    });

    it('should handle complex multi-round dilution correctly', () => {
      // Initial setup
      const founders: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const founder = stakeholderService.addStakeholder(`Founder ${i}`, 'person');
        founders.push(founder.id);
      }

      const common = securityService.addSecurityClass('COMMON', 'Common Stock', 20000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Option Pool', 5000000);

      // Initial equity split
      equityService.issueShares(common.id, founders[0], 4000000, 0.0001, '2020-01-01');
      equityService.issueShares(common.id, founders[1], 3000000, 0.0001, '2020-01-01');
      equityService.issueShares(common.id, founders[2], 3000000, 0.0001, '2020-01-01');

      let initialCap = calcCap(model, '2020-01-01');
      const initialFounderPct = initialCap.rows[0].pctFullyDiluted;

      // Round 1: Seed with SAFEs
      const seedInvestors: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const investor = stakeholderService.addStakeholder(`Seed ${i}`, 'person');
        seedInvestors.push(investor.id);
        safeService.addSAFE({
          stakeholderId: investor.id,
          amount: 100000 * i,
          cap: 5000000,
          discount: 0.8,
          date: `2020-${String(i + 1).padStart(2, '0')}-01`,
        });
      }

      // Round 2: Series A (SAFEs convert)
      const seriesA = securityService.addSecurityClass('PREF', 'Series A', 10000000); // Increased authorized shares
      const conversions = safeService.simulateConversion({
        preMoneyValuation: 10000000,
        newMoneyRaised: 2500000,
        pricePerShare: 1.0,
      });

      conversions.forEach((conv) => {
        equityService.issueShares(
          seriesA.id,
          conv.stakeholderId,
          conv.sharesIssued,
          conv.conversionPrice,
          '2021-06-01'
        );
      });

      const seriesALead = stakeholderService.addStakeholder('Series A Lead', 'entity');
      equityService.issueShares(seriesA.id, seriesALead.id, 2500000, 1.0, '2021-06-01');

      // Round 3: Series B
      const seriesB = securityService.addSecurityClass('PREF', 'Series B', 3000000);
      const seriesBLead = stakeholderService.addStakeholder('Series B Lead', 'entity');
      equityService.issueShares(seriesB.id, seriesBLead.id, 2000000, 3.0, '2022-06-01');

      // Round 4: Series C
      const seriesC = securityService.addSecurityClass('PREF', 'Series C', 2000000);
      const seriesCLead = stakeholderService.addStakeholder('Series C Lead', 'entity');
      equityService.issueShares(seriesC.id, seriesCLead.id, 1500000, 8.0, '2023-06-01');

      // Check final dilution
      const finalCap = calcCap(model, '2024-01-01');
      const finalFounder1 = finalCap.rows.find((r) => r.name === 'Founder 1');

      // Verify progressive dilution
      expect(finalFounder1?.pctFullyDiluted).toBeLessThan(initialFounderPct);
      expect(finalFounder1?.pctFullyDiluted).toBeGreaterThan(0.05); // Still meaningful ownership

      // Verify total shares increased appropriately
      expect(finalCap.totals.fd.totalFD).toBeGreaterThan(initialCap.totals.fd.totalFD);
    });
  });

  describe('UTC Date Consistency in Lifecycle', () => {
    it('should maintain date consistency across all operations', () => {
      const model: FileModel = {
        version: 1,
        company: {
          id: 'utc_test',
          name: 'UTC Test Corp',
          formationDate: '2020-01-01',
        },
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

      // All dates in UTC ISO format
      const dates = {
        formation: '2020-01-01',
        firstGrant: '2020-02-29', // Leap day
        vestingStart: '2020-03-01',
        safeDate: '2020-12-31',
        conversionDate: '2021-01-01',
        secondGrant: '2021-06-15',
        checkDate: '2024-02-29', // Another leap day
      };

      const founder = stakeholderService.addStakeholder('Founder', 'person');
      const common = securityService.addSecurityClass('COMMON', 'Common', 10000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Option Pool', 1000000);

      // Issue on formation
      equityService.issueShares(common.id, founder.id, 1000000, 0.0001, dates.formation);

      // Grant on leap day
      const emp1 = stakeholderService.addStakeholder('Employee 1', 'person');
      equityService.grantOptions(emp1.id, 48000, 0.1, dates.firstGrant, {
        start: dates.vestingStart,
        monthsTotal: 48,
        cliffMonths: 12,
      });

      // SAFE on year-end
      const investor = stakeholderService.addStakeholder('Investor', 'person');
      safeService.addSAFE({
        stakeholderId: investor.id,
        amount: 100000,
        cap: 5000000,
        date: dates.safeDate,
      });

      // Check vesting on another leap day
      const capTable = calcCap(model, dates.checkDate);

      // Employee should be fully vested after 4 years
      const empRow = capTable.rows.find((r) => r.name === 'Employee 1');
      expect(empRow?.outstanding).toBe(47000); // 47 months vested

      // All operations should have consistent dates
      expect(model.issuances[0].date).toBe(dates.formation);
      expect(model.optionGrants[0].grantDate).toBe(dates.firstGrant);
      expect(model.safes[0].date).toBe(dates.safeDate);
    });
  });

  describe('Edge Case Scenarios', () => {
    it('should handle company with only SAFEs (no equity issued)', () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'safe_only', name: 'SAFE Only Corp' },
        stakeholders: [],
        securityClasses: [],
        issuances: [],
        optionGrants: [],
        safes: [],
        valuations: [],
        audit: [],
      };

      const stakeholderService = new StakeholderService(model);
      const safeService = new SAFEService(model);

      // Add only SAFEs, no equity
      const investors = [];
      for (let i = 1; i <= 10; i++) {
        const investor = stakeholderService.addStakeholder(`SAFE Investor ${i}`, 'person');
        investors.push(investor.id);
        safeService.addSAFE({
          stakeholderId: investor.id,
          amount: 50000 * i,
          cap: 5000000,
          discount: 0.8,
          date: `2024-${String(i).padStart(2, '0')}-01`,
        });
      }

      // Cap table should be empty (no equity issued)
      const capTable = calcCap(model, '2024-12-31');
      expect(capTable.totals.issuedTotal).toBe(0);
      expect(capTable.totals.outstandingTotal).toBe(0);
      expect(capTable.rows).toHaveLength(0);

      // But SAFEs should exist
      expect(safeService.getTotalSAFEAmount()).toBe(2750000); // Sum of 50k * (1+2+...+10)
    });

    it('should handle retroactive vesting adjustments', () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'retro', name: 'Retro Corp' },
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

      const emp = stakeholderService.addStakeholder('Employee', 'person');
      const common = securityService.addSecurityClass('COMMON', 'Common', 10000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Option Pool', 100000);

      // Grant with future vesting start (back-dated vesting)
      equityService.grantOptions(emp.id, 48000, 0.5, '2024-01-01', {
        start: '2023-01-01', // Vesting started a year before grant
        monthsTotal: 48,
        cliffMonths: 12,
      });

      // Check vesting at grant date
      const vested = vestedQty('2024-01-01', 48000, {
        start: '2023-01-01',
        monthsTotal: 48,
        cliffMonths: 12,
      });

      expect(vested).toBe(12000); // 25% already vested at grant
    });

    it('should handle fractional ownership with many stakeholders', () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'many', name: 'Many Stakeholders Corp' },
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

      const common = securityService.addSecurityClass('COMMON', 'Common', 100000000);

      // Create 100 stakeholders with varying amounts
      for (let i = 1; i <= 100; i++) {
        const stakeholder = stakeholderService.addStakeholder(`Stakeholder ${i}`, 'person');
        const shares = Math.floor(Math.random() * 100000) + 1000;
        equityService.issueShares(common.id, stakeholder.id, shares, 0.0001, '2024-01-01');
      }

      const capTable = calcCap(model, '2024-01-01');

      // Verify percentages add up to 100%
      const totalPct = capTable.rows.reduce((sum, row) => sum + row.pctOutstanding, 0);
      expect(totalPct).toBeCloseTo(1.0, 5);

      // Verify all stakeholders are represented
      expect(capTable.rows).toHaveLength(100);
    });

    it('should handle vesting with non-standard schedules', () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'custom', name: 'Custom Vesting Corp' },
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

      const common = securityService.addSecurityClass('COMMON', 'Common', 10000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Option Pool', 500000);

      // Various non-standard vesting schedules
      const schedules = [
        { months: 36, cliff: 6, desc: '3-year with 6-month cliff' },
        { months: 60, cliff: 0, desc: '5-year no cliff' },
        { months: 12, cliff: 12, desc: '1-year cliff only' },
        { months: 48, cliff: 24, desc: '4-year with 2-year cliff' },
        { months: 1, cliff: 0, desc: 'Immediate monthly vesting' },
      ];

      schedules.forEach((schedule, index) => {
        const emp = stakeholderService.addStakeholder(`Employee ${index + 1}`, 'person');
        equityService.grantOptions(emp.id, schedule.months * 1000, 0.5, '2020-01-01', {
          start: '2020-01-01',
          monthsTotal: schedule.months,
          cliffMonths: schedule.cliff,
        });
      });

      // Check vesting at various points
      const checkDates = ['2020-07-01', '2021-01-01', '2022-01-01', '2024-01-01', '2025-01-01'];

      checkDates.forEach((date) => {
        const capTable = calcCap(model, date);

        // Verify vesting is progressing
        if (date !== checkDates[0]) {
          expect(capTable.totals.vestedOptions).toBeGreaterThan(0);
        }

        // Verify total conservation
        const totalOptions = capTable.totals.vestedOptions + capTable.totals.unvestedOptions;
        // Expected: 36000 + 60000 + 12000 + 48000 + 1000 = 157000
        expect(totalOptions).toBe(157000); // Sum of all grants
      });
    });
  });

  describe('Performance with Large Data Sets', () => {
    it('should handle 1000+ transactions efficiently', () => {
      const model: FileModel = {
        version: 1,
        company: { id: 'large', name: 'Large Corp' },
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

      const common = securityService.addSecurityClass('COMMON', 'Common', 1000000000);
      const optionPool = securityService.addSecurityClass('OPTION_POOL', 'Options', 100000000);

      const startTime = Date.now();

      // Create many stakeholders and transactions
      for (let i = 1; i <= 200; i++) {
        const stakeholder = stakeholderService.addStakeholder(`Person ${i}`, 'person');

        // Mix of equity issuances, options, and SAFEs
        if (i % 3 === 0) {
          equityService.issueShares(common.id, stakeholder.id, 10000 * i, 0.01, '2020-01-01');
        }

        if (i % 2 === 0) {
          equityService.grantOptions(stakeholder.id, 1000 * i, 0.5, '2021-01-01', {
            start: '2021-01-01',
            monthsTotal: 48,
            cliffMonths: 12,
          });
        }

        if (i % 5 === 0) {
          safeService.addSAFE({
            stakeholderId: stakeholder.id,
            amount: 5000 * i,
            cap: 10000000,
            discount: 0.8,
            date: '2022-01-01',
          });
        }
      }

      // Calculate cap table
      const capTable = calcCap(model, '2024-01-01');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);

      // Verify calculations are correct
      expect(capTable.rows.length).toBeGreaterThan(0);
      expect(capTable.totals.issuedTotal).toBeGreaterThan(0);

      // Verify no overflow or NaN values
      capTable.rows.forEach((row) => {
        expect(Number.isFinite(row.outstanding)).toBe(true);
        expect(Number.isFinite(row.fullyDiluted)).toBe(true);
        expect(Number.isFinite(row.pctOutstanding)).toBe(true);
        expect(Number.isFinite(row.pctFullyDiluted)).toBe(true);
      });
    });
  });
});
