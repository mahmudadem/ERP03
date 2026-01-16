/**
 * FirestoreCompanyRepository.ts
 * 
 * Layer: Infrastructure
 * Purpose: Implementation of ICompanyRepository using Firestore.
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { Company } from '../../../../domain/core/entities/Company';
import { CompanyMapper } from '../../mappers/CoreMappers';
import { InfrastructureError } from '../../../errors/InfrastructureError';

export class FirestoreCompanyRepository extends BaseFirestoreRepository<Company> implements ICompanyRepository {
  protected collectionName = 'companies';

  protected toDomain(data: any): Company {
    return CompanyMapper.toDomain(data);
  }

  protected toPersistence(entity: Company): any {
    return CompanyMapper.toPersistence(entity);
  }

  async findByTaxId(taxId: string): Promise<Company | null> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('taxId', '==', taxId)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return this.toDomain(snapshot.docs[0].data());
    } catch (error) {
      throw new InfrastructureError('Error finding company by TaxID', error);
    }
  }

  async findByNameAndOwner(name: string, ownerId: string): Promise<Company | null> {
    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('ownerId', '==', ownerId)
        .where('name', '==', name)
        .limit(1)
        .get();
      
      if (snapshot.empty) return null;
      return this.toDomain(snapshot.docs[0].data());
    } catch (error) {
      throw new InfrastructureError('Error finding company by Name and Owner', error);
    }
  }

  async getUserCompanies(userId: string): Promise<Company[]> {
    try {
      // In a real scenario, this might query a join collection 'company_users' first.
      // For MVP, assuming ownerId check or simple permission check logic.
      const snapshot = await this.db.collection(this.collectionName)
        .where('ownerId', '==', userId)
        .get();

      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error getting user companies', error);
    }
  }

  async enableModule(companyId: string, moduleName: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(companyId).update({
        modules: FieldValue.arrayUnion(moduleName)
      });
    } catch (error) {
      throw new InfrastructureError('Error enabling module', error);
    }
  }

  async update(companyId: string, updates: Partial<Company>): Promise<Company> {
    try {
      // Convert updates to persistence format if needed
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.baseCurrency !== undefined) updateData.baseCurrency = updates.baseCurrency;
      if (updates.fiscalYearStart !== undefined) updateData.fiscalYearStart = updates.fiscalYearStart;
      if (updates.fiscalYearEnd !== undefined) updateData.fiscalYearEnd = updates.fiscalYearEnd;
      if (updates.taxId !== undefined) updateData.taxId = updates.taxId;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.subscriptionPlan !== undefined) updateData.subscriptionPlan = updates.subscriptionPlan;
      if (updates.modules !== undefined) updateData.modules = updates.modules;
      if ((updates as any).features !== undefined) updateData.features = (updates as any).features;
      
      updateData.updatedAt = new Date();

      await this.db.collection(this.collectionName).doc(companyId).update(updateData);
      
      // Fetch and return updated company
      const updated = await this.findById(companyId);
      if (!updated) {
        throw new Error('Company not found after update');
      }
      return updated;
    } catch (error) {
      throw new InfrastructureError('Error updating company', error);
    }
  }

  async disableModule(companyId: string, moduleName: string): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(companyId).update({
        modules: FieldValue.arrayRemove(moduleName)
      });
    } catch (error) {
      throw new InfrastructureError('Error disabling module', error);
    }
  }

  async updateBundle(companyId: string, bundleId: string): Promise<Company> {
    try {
      await this.db.collection(this.collectionName).doc(companyId).update({
        subscriptionPlan: bundleId,
        updatedAt: new Date()
      });
      
      const updated = await this.findById(companyId);
      if (!updated) {
        throw new Error('Company not found after bundle update');
      }
      return updated;
    } catch (error) {
      throw new InfrastructureError('Error updating company bundle', error);
    }
  }

  async updateFeatures(companyId: string, features: string[]): Promise<void> {
    try {
      await this.db.collection(this.collectionName).doc(companyId).update({
        features: features,
        updatedAt: new Date()
      });
    } catch (error) {
      throw new InfrastructureError('Error updating company features', error);
    }
  }

  async listAll(): Promise<Company[]> {
    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map(doc => this.toDomain(doc.data()));
    } catch (error) {
      throw new InfrastructureError('Error listing all companies', error);
    }
  }

  async delete(companyId: string): Promise<void> {
    try {
      // Firestore doesn't auto-delete subcollections, so we need to do it manually
      console.log(`[FirestoreCompanyRepository] Deleting company ${companyId} and all related data...`);
      
      // 1. Delete company document itself
      await this.db.collection(this.collectionName).doc(companyId).delete();
      console.log(`[FirestoreCompanyRepository] Company document deleted`);

      // 2. Delete companyModules subcollections
      try {
        const modulesSnapshot = await this.db.collection('companyModules').doc(companyId).collection('modules').get();
        const batch = this.db.batch();
        modulesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await this.db.collection('companyModules').doc(companyId).delete();
        console.log(`[FirestoreCompanyRepository] Deleted ${modulesSnapshot.size} module records`);
      } catch (err) {
        console.warn(`[FirestoreCompanyRepository] No modules to delete or error:`, err);
      }

      // 3. Delete companyRoles
      try {
        const rolesSnapshot = await this.db.collection('companyRoles').where('companyId', '==', companyId).get();
        const batch2 = this.db.batch();
        rolesSnapshot.docs.forEach(doc => batch2.delete(doc.ref));
        await batch2.commit();
        console.log(`[FirestoreCompanyRepository] Deleted ${rolesSnapshot.size} role records`);
      } catch (err) {
        console.warn(`[FirestoreCompanyRepository] No roles to delete or error:`, err);
      }

      // 4. Delete companyUsers (role assignments)
      try {
        const usersSnapshot = await this.db.collection('companyUsers').where('companyId', '==', companyId).get();
        const batch3 = this.db.batch();
        usersSnapshot.docs.forEach(doc => batch3.delete(doc.ref));
        await batch3.commit();
        console.log(`[FirestoreCompanyRepository] Deleted ${usersSnapshot.size} user role assignments`);
      } catch (err) {
        console.warn(`[FirestoreCompanyRepository] No user assignments to delete or error:`, err);
      }

      console.log(`[FirestoreCompanyRepository] Successfully deleted company ${companyId} and all related data`);
    } catch (error) {
      throw new InfrastructureError(`Error deleting company ${companyId}`, error);
    }
  }
}