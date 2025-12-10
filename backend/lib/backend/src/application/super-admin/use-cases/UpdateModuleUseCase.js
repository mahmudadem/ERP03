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
exports.UpdateModuleUseCase = void 0;
class UpdateModuleUseCase {
    constructor(moduleRepo) {
        this.moduleRepo = moduleRepo;
    }
    async execute(input) {
        const { id } = input, updates = __rest(input, ["id"]);
        await this.moduleRepo.update(id, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }));
    }
}
exports.UpdateModuleUseCase = UpdateModuleUseCase;
//# sourceMappingURL=UpdateModuleUseCase.js.map