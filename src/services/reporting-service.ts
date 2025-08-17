import { FileModel, calcCap, CapTableResult } from '../model.js';
import { StakeholderService } from './stakeholder-service.js';
import { SecurityService } from './security-service.js';

export class ReportingService {
  private stakeholderService: StakeholderService;
  private securityService: SecurityService;

  constructor(private model: FileModel) {
    this.stakeholderService = new StakeholderService(model);
    this.securityService = new SecurityService(model);
  }

  generateCapTable(asOfDate: string = new Date().toISOString().slice(0, 10)): CapTableResult {
    return calcCap(this.model, asOfDate);
  }

  exportJSON(): string {
    return JSON.stringify(this.model, null, 2);
  }

  exportCSV(includeOptions = true): string {
    const lines: string[] = ['stakeholder_name,stakeholder_id,type,security_class,quantity,price_per_share,date'];
    
    for (const issuance of this.model.issuances) {
      const stakeholder = this.stakeholderService.getStakeholder(issuance.stakeholderId);
      const securityClass = this.securityService.getSecurityClass(issuance.securityClassId);
      
      lines.push([
        stakeholder?.name ?? issuance.stakeholderId,
        issuance.stakeholderId,
        'ISSUANCE',
        securityClass?.label ?? issuance.securityClassId,
        issuance.qty.toString(),
        (issuance.pps ?? 0).toString(),
        issuance.date
      ].join(','));
    }
    
    if (includeOptions) {
      for (const grant of this.model.optionGrants) {
        const stakeholder = this.stakeholderService.getStakeholder(grant.stakeholderId);
        
        lines.push([
          stakeholder?.name ?? grant.stakeholderId,
          grant.stakeholderId,
          'OPTION',
          'Option Grant',
          grant.qty.toString(),
          grant.exercise.toString(),
          grant.grantDate
        ].join(','));
      }
    }
    
    return lines.join('\n');
  }

  generateSummary(asOfDate?: string): string {
    const date = asOfDate ?? new Date().toISOString().slice(0, 10);
    const capTable = this.generateCapTable(date);
    const { totals } = capTable;
    
    const lines: string[] = [
      `Cap Table Summary - ${this.model.company.name}`,
      `As of: ${date}`,
      '',
      'Ownership Breakdown:',
      '===================',
      'Name'.padEnd(25) + 'Outstanding'.padStart(15) + '  %Out'.padStart(8) + 'Fully Diluted'.padStart(15) + '  %FD'.padStart(8)
    ];
    
    for (const row of capTable.rows) {
      lines.push(
        row.name.padEnd(25) +
        row.outstanding.toLocaleString().padStart(15) +
        (row.pctOutstanding * 100).toFixed(2).padStart(7) + '%' +
        row.fullyDiluted.toLocaleString().padStart(15) +
        (row.pctFullyDiluted * 100).toFixed(2).padStart(7) + '%'
      );
    }
    
    lines.push('');
    lines.push('Totals:');
    lines.push('=======');
    lines.push(`Issued Equity:         ${totals.issuedTotal.toLocaleString()}`);
    lines.push(`Vested Options:        ${totals.vestedOptions.toLocaleString()}`);
    lines.push(`Unvested Options:      ${totals.unvestedOptions.toLocaleString()}`);
    lines.push(`Outstanding Total:     ${totals.outstandingTotal.toLocaleString()}`);
    lines.push('');
    lines.push('Fully Diluted:');
    lines.push(`  Issued:              ${totals.fd.issued.toLocaleString()}`);
    lines.push(`  All Grants:          ${totals.fd.grants.toLocaleString()}`);
    lines.push(`  Pool Remaining:      ${totals.fd.poolRemaining.toLocaleString()}`);
    lines.push(`  Total FD:            ${totals.fd.totalFD.toLocaleString()}`);
    
    return lines.join('\n');
  }

  generateStakeholderReport(stakeholderId: string): string {
    const stakeholder = this.stakeholderService.getStakeholder(stakeholderId);
    if (!stakeholder) {
      throw new Error(`Stakeholder with ID "${stakeholderId}" not found`);
    }
    
    const lines: string[] = [
      `Stakeholder Report: ${stakeholder.name}`,
      `Type: ${stakeholder.type}`,
      stakeholder.email ? `Email: ${stakeholder.email}` : '',
      '',
      'Equity Holdings:',
      '================'
    ];
    
    const issuances = this.model.issuances.filter(i => i.stakeholderId === stakeholderId);
    if (issuances.length > 0) {
      lines.push('');
      lines.push('Share Issuances:');
      for (const issuance of issuances) {
        const sc = this.securityService.getSecurityClass(issuance.securityClassId);
        lines.push(`  - ${issuance.qty.toLocaleString()} shares of ${sc?.label ?? issuance.securityClassId}`);
        lines.push(`    Date: ${issuance.date}, Price: $${issuance.pps ?? 0}`);
        if (issuance.cert) lines.push(`    Certificate: ${issuance.cert}`);
      }
    }
    
    const grants = this.model.optionGrants.filter(g => g.stakeholderId === stakeholderId);
    if (grants.length > 0) {
      lines.push('');
      lines.push('Option Grants:');
      for (const grant of grants) {
        lines.push(`  - ${grant.qty.toLocaleString()} options at $${grant.exercise}`);
        lines.push(`    Grant Date: ${grant.grantDate}`);
        if (grant.vesting) {
          lines.push(`    Vesting: ${grant.vesting.monthsTotal} months, ${grant.vesting.cliffMonths} month cliff`);
          lines.push(`    Start: ${grant.vesting.start}`);
        }
      }
    }
    
    if (issuances.length === 0 && grants.length === 0) {
      lines.push('  No equity holdings');
    }
    
    return lines.join('\n').replace(/\n\n+/g, '\n\n');
  }

  generateSecurityClassReport(securityClassId: string): string {
    const sc = this.securityService.getSecurityClass(securityClassId);
    if (!sc) {
      throw new Error(`Security class with ID "${securityClassId}" not found`);
    }
    
    const lines: string[] = [
      `Security Class Report: ${sc.label}`,
      `Type: ${sc.kind}`,
      `Authorized: ${sc.authorized.toLocaleString()}`,
      sc.parValue !== undefined ? `Par Value: $${sc.parValue}` : '',
      ''
    ];
    
    if (sc.kind === 'OPTION_POOL') {
      const pool = this.securityService.validatePoolCapacity(securityClassId);
      lines.push('Pool Status:');
      lines.push(`  Authorized: ${pool.authorized.toLocaleString()}`);
      lines.push(`  Granted:    ${pool.granted.toLocaleString()}`);
      lines.push(`  Remaining:  ${pool.remaining.toLocaleString()}`);
      lines.push(`  Utilization: ${((pool.granted / pool.authorized) * 100).toFixed(1)}%`);
    } else {
      const issued = this.securityService.getIssuedByClass(securityClassId);
      const remaining = this.securityService.getRemainingAuthorized(securityClassId);
      
      lines.push('Issuance Status:');
      lines.push(`  Authorized: ${sc.authorized.toLocaleString()}`);
      lines.push(`  Issued:     ${issued.toLocaleString()}`);
      lines.push(`  Remaining:  ${remaining.toLocaleString()}`);
      lines.push(`  Utilization: ${((issued / sc.authorized) * 100).toFixed(1)}%`);
      
      const issuances = this.model.issuances.filter(i => i.securityClassId === securityClassId);
      if (issuances.length > 0) {
        lines.push('');
        lines.push('Issuances:');
        for (const issuance of issuances) {
          const stakeholder = this.stakeholderService.getStakeholder(issuance.stakeholderId);
          lines.push(`  - ${stakeholder?.name ?? issuance.stakeholderId}: ${issuance.qty.toLocaleString()} shares`);
        }
      }
    }
    
    return lines.join('\n').replace(/\n\n+/g, '\n\n');
  }
}