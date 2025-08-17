import { randomUUID } from 'node:crypto';
import {
  FileModel,
  Issuance,
  IssuanceSchema,
  OptionGrant,
  OptionGrantSchema,
  Vesting,
} from '../model.js';
import { StakeholderService } from './stakeholder-service.js';
import { SecurityService } from './security-service.js';

export class EquityService {
  private stakeholderService: StakeholderService;
  private securityService: SecurityService;

  constructor(private model: FileModel) {
    this.stakeholderService = new StakeholderService(model);
    this.securityService = new SecurityService(model);
  }

  issueShares(
    securityClassId: string,
    stakeholderId: string,
    qty: number,
    pps: number = 0,
    date: string = new Date().toISOString().slice(0, 10),
    cert?: string
  ): Issuance {
    this.securityService.validateSecurityClassExists(securityClassId);
    this.stakeholderService.validateStakeholderExists(stakeholderId);

    const securityClass = this.securityService.getSecurityClass(securityClassId)!;
    if (securityClass.kind === 'OPTION_POOL') {
      throw new Error('Cannot issue shares from an option pool - use grantOptions instead');
    }

    const remaining = this.securityService.getRemainingAuthorized(securityClassId);
    if (qty > remaining) {
      throw new Error(
        `Cannot issue ${qty} shares - only ${remaining} authorized shares remaining for "${securityClass.label}"`
      );
    }

    const issuance: Issuance = {
      id: `is_${randomUUID()}`,
      securityClassId,
      stakeholderId,
      qty,
      pps,
      date,
      cert,
    };

    const validated = IssuanceSchema.parse(issuance);
    this.model.issuances.push(validated);
    return validated;
  }

  grantOptions(
    stakeholderId: string,
    qty: number,
    exercise: number,
    grantDate: string = new Date().toISOString().slice(0, 10),
    vesting?: Vesting
  ): OptionGrant {
    this.stakeholderService.validateStakeholderExists(stakeholderId);

    const poolCapacity = this.securityService.validatePoolCapacity();
    if (qty > poolCapacity.remaining) {
      throw new Error(
        `Cannot grant ${qty} options - only ${poolCapacity.remaining} options remaining in pool`
      );
    }

    const grant: OptionGrant = {
      id: `og_${randomUUID()}`,
      stakeholderId,
      qty,
      exercise,
      grantDate,
      vesting,
    };

    const validated = OptionGrantSchema.parse(grant);
    this.model.optionGrants.push(validated);
    return validated;
  }

  getIssuancesByStakeholder(stakeholderId: string): Issuance[] {
    return this.model.issuances.filter((i) => i.stakeholderId === stakeholderId);
  }

  getGrantsByStakeholder(stakeholderId: string): OptionGrant[] {
    return this.model.optionGrants.filter((g) => g.stakeholderId === stakeholderId);
  }

  getIssuancesBySecurityClass(securityClassId: string): Issuance[] {
    return this.model.issuances.filter((i) => i.securityClassId === securityClassId);
  }

  transferShares(
    issuanceId: string,
    toStakeholderId: string,
    qty?: number
  ): { from: Issuance; to: Issuance } {
    const issuanceIndex = this.model.issuances.findIndex((i) => i.id === issuanceId);
    if (issuanceIndex === -1) {
      throw new Error(`Issuance with ID "${issuanceId}" not found`);
    }

    this.stakeholderService.validateStakeholderExists(toStakeholderId);

    const issuance = this.model.issuances[issuanceIndex];
    const transferQty = qty ?? issuance.qty;

    if (transferQty > issuance.qty) {
      throw new Error(
        `Cannot transfer ${transferQty} shares - issuance only has ${issuance.qty} shares`
      );
    }

    if (transferQty === issuance.qty) {
      issuance.stakeholderId = toStakeholderId;
      return { from: issuance, to: issuance };
    }

    issuance.qty -= transferQty;

    const newIssuance: Issuance = {
      id: `is_${randomUUID()}`,
      securityClassId: issuance.securityClassId,
      stakeholderId: toStakeholderId,
      qty: transferQty,
      pps: issuance.pps,
      date: new Date().toISOString().slice(0, 10),
      cert: undefined,
    };

    const validated = IssuanceSchema.parse(newIssuance);
    this.model.issuances.push(validated);

    return { from: issuance, to: validated };
  }

  cancelIssuance(issuanceId: string): void {
    const index = this.model.issuances.findIndex((i) => i.id === issuanceId);
    if (index === -1) {
      throw new Error(`Issuance with ID "${issuanceId}" not found`);
    }

    this.model.issuances.splice(index, 1);
  }

  cancelGrant(grantId: string): void {
    const index = this.model.optionGrants.findIndex((g) => g.id === grantId);
    if (index === -1) {
      throw new Error(`Grant with ID "${grantId}" not found`);
    }

    this.model.optionGrants.splice(index, 1);
  }

  exerciseOptions(
    grantId: string,
    qty: number,
    exerciseDate: string = new Date().toISOString().slice(0, 10)
  ): Issuance {
    const grantIndex = this.model.optionGrants.findIndex((g) => g.id === grantId);
    if (grantIndex === -1) {
      throw new Error(`Grant with ID "${grantId}" not found`);
    }

    const grant = this.model.optionGrants[grantIndex];

    if (qty > grant.qty) {
      throw new Error(`Cannot exercise ${qty} options - grant only has ${grant.qty} options`);
    }

    const commonClasses = this.securityService.listByKind('COMMON');
    if (commonClasses.length === 0) {
      throw new Error('No common stock class found for option exercise');
    }

    const commonClass = commonClasses[0];

    const issuance = this.issueShares(
      commonClass.id,
      grant.stakeholderId,
      qty,
      grant.exercise,
      exerciseDate
    );

    grant.qty -= qty;
    if (grant.qty === 0) {
      this.model.optionGrants.splice(grantIndex, 1);
    }

    return issuance;
  }
}
