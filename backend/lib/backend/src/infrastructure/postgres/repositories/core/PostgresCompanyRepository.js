"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresCompanyRepository = void 0;
const postgresClient_1 = require("../../config/postgresClient");
class PostgresCompanyRepository {
    async save(company) {
        // TODO: Implement INSERT/UPDATE SQL logic
        await postgresClient_1.pool.query('INSERT INTO companies ...', []);
    }
    async findById(id) {
        // TODO: Implement SELECT WHERE id = $1
        return null;
    }
    async findByTaxId(taxId) {
        // TODO: Implement SELECT WHERE tax_id = $1
        return null;
    }
    async getUserCompanies(userId) {
        // TODO: Implement JOIN query
        return [];
    }
    async enableModule(companyId, moduleName) {
        // TODO: Implement JSONB array update
    }
}
exports.PostgresCompanyRepository = PostgresCompanyRepository;
//# sourceMappingURL=PostgresCompanyRepository.js.map