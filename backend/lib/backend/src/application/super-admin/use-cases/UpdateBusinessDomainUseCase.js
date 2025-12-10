"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBusinessDomainUseCase = void 0;
class UpdateBusinessDomainUseCase {
    constructor(businessDomainRepo) {
        this.businessDomainRepo = businessDomainRepo;
    }
    async execute(input) {
        const { id } = input, updates = __rest(input, ["id"]);
        await this.businessDomainRepo.update(id, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }));
    }
}
exports.UpdateBusinessDomainUseCase = UpdateBusinessDomainUseCase;
//# sourceMappingURL=UpdateBusinessDomainUseCase.js.map