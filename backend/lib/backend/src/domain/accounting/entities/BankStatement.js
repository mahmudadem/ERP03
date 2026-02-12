"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankStatement = void 0;
class BankStatement {
    constructor(id, companyId, accountId, bankName, statementDate, importedAt, importedBy, lines = []) {
        this.id = id;
        this.companyId = companyId;
        this.accountId = accountId;
        this.bankName = bankName;
        this.statementDate = statementDate;
        this.importedAt = importedAt;
        this.importedBy = importedBy;
        this.lines = lines;
    }
    withLines(lines) {
        return new BankStatement(this.id, this.companyId, this.accountId, this.bankName, this.statementDate, this.importedAt, this.importedBy, lines);
    }
}
exports.BankStatement = BankStatement;
//# sourceMappingURL=BankStatement.js.map