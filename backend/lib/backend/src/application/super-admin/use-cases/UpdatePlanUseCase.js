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
exports.UpdatePlanUseCase = void 0;
class UpdatePlanUseCase {
    constructor(planRepo) {
        this.planRepo = planRepo;
    }
    async execute(input) {
        const { id } = input, updates = __rest(input, ["id"]);
        const updateData = Object.assign(Object.assign({}, updates), { updatedAt: new Date() });
        await this.planRepo.update(id, updateData);
    }
}
exports.UpdatePlanUseCase = UpdatePlanUseCase;
//# sourceMappingURL=UpdatePlanUseCase.js.map