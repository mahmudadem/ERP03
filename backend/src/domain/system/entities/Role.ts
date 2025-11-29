
export class Role {
  constructor(
    public id: string,
    public name: string,
    public permissions: string[],
    public moduleBundles: string[] = [],
    public explicitPermissions: string[] = [],
    public resolvedPermissions: string[] = []
  ) {}
}
