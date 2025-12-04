/**
 * UpdateCompanyProfileUseCase
 * Updates company profile information
 */

import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../domain/core/entities/Company';
import { ApiError } from '../../../api/errors/ApiError';

interface UpdateCompanyProfileInput {
  companyId: string;
  updates: {
    name?: string;
    country?: string;
    baseCurrency?: string;
    fiscalYearStart?: number;
    fiscalYearEnd?: number;
    logoUrl?: string;
    contactInfo?: {
      email?: string;
      phone?: string;
      address?: string;
    };
  };
}

export class UpdateCompanyProfileUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) {}

  async execute(input: UpdateCompanyProfileInput): Promise<Company> {
    // Validate input
    this.validateInput(input);

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound(`Company with ID ${input.companyId} not found`);
    }

    // Prepare safe update object (only allowed fields)
    const safeUpdates: Partial<Company> = {};

    if (input.updates.name !== undefined) {
      safeUpdates.name = input.updates.name;
    }

    if (input.updates.country !== undefined) {
      safeUpdates.country = input.updates.country;
    }

    if (input.updates.baseCurrency !== undefined) {
      safeUpdates.baseCurrency = input.updates.baseCurrency;
    }

    if (input.updates.fiscalYearStart !== undefined) {
      safeUpdates.fiscalYearStart = input.updates.fiscalYearStart;
    }

    if (input.updates.fiscalYearEnd !== undefined) {
      safeUpdates.fiscalYearEnd = input.updates.fiscalYearEnd;
    }

    if (input.updates.logoUrl !== undefined) {
      safeUpdates.logoUrl = input.updates.logoUrl;
    }

    if (input.updates.contactInfo !== undefined) {
      safeUpdates.contactInfo = input.updates.contactInfo;
    }

    // Update company
    const updatedCompany = await this.companyRepository.update(input.companyId, safeUpdates);

    return updatedCompany;
  }

  private validateInput(input: UpdateCompanyProfileInput): void {
    const { updates } = input;

    // Validate name
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || updates.name.trim().length === 0) {
        throw ApiError.badRequest('Company name cannot be empty');
      }
    }

    // Validate baseCurrency
    if (updates.baseCurrency !== undefined) {
      const currencyRegex = /^[A-Z]{3}$/;
      if (!currencyRegex.test(updates.baseCurrency)) {
        throw ApiError.badRequest('Currency code must be a 3-letter uppercase code (e.g., USD, EUR)');
      }
    }

    // Validate fiscalYearStart
    if (updates.fiscalYearStart !== undefined) {
      if (!Number.isInteger(updates.fiscalYearStart) || updates.fiscalYearStart < 1 || updates.fiscalYearStart > 12) {
        throw ApiError.badRequest('Fiscal year start must be an integer between 1 and 12');
      }
    }

    // Validate fiscalYearEnd
    if (updates.fiscalYearEnd !== undefined) {
      if (!Number.isInteger(updates.fiscalYearEnd) || updates.fiscalYearEnd < 1 || updates.fiscalYearEnd > 12) {
        throw ApiError.badRequest('Fiscal year end must be an integer between 1 and 12');
      }
    }
  }
}
