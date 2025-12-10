"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BundleRegistryController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListBundlesUseCase_1 = require("../../../application/super-admin/use-cases/ListBundlesUseCase");
const CreateBundleUseCase_1 = require("../../../application/super-admin/use-cases/CreateBundleUseCase");
const UpdateBundleUseCase_1 = require("../../../application/super-admin/use-cases/UpdateBundleUseCase");
const DeleteBundleUseCase_1 = require("../../../application/super-admin/use-cases/DeleteBundleUseCase");
class BundleRegistryController {
    static async list(req, res, next) {
        try {
            const useCase = new ListBundlesUseCase_1.ListBundlesUseCase(bindRepositories_1.diContainer.bundleRegistryRepository);
            const bundles = await useCase.execute();
            res.json({ success: true, data: bundles });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const useCase = new CreateBundleUseCase_1.CreateBundleUseCase(bindRepositories_1.diContainer.bundleRegistryRepository);
            await useCase.execute(req.body);
            res.status(201).json({ success: true, message: 'Bundle created successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const useCase = new UpdateBundleUseCase_1.UpdateBundleUseCase(bindRepositories_1.diContainer.bundleRegistryRepository);
            await useCase.execute(Object.assign({ id: req.params.id }, req.body));
            res.json({ success: true, message: 'Bundle updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const useCase = new DeleteBundleUseCase_1.DeleteBundleUseCase(bindRepositories_1.diContainer.bundleRegistryRepository);
            await useCase.execute(req.params.id);
            res.json({ success: true, message: 'Bundle deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BundleRegistryController = BundleRegistryController;
//# sourceMappingURL=BundleRegistryController.js.map