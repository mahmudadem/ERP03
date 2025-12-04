// Company Admin Types

export interface Role {
    id: string;
    name: string;
    description: string;
    permissionsCount: number;
    createdAt: string;
}

export interface Module {
    id: string;
    name: string;
    description: string;
    status: 'enabled' | 'disabled';
    features: string[];
}

export interface Feature {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
    category: string;
}

export interface CompanyUser {
    id: string;
    name: string;
    email: string;
    role: string;
    status: 'active' | 'disabled';
}

export interface Bundle {
    id: string;
    name: string;
    description: string;
    modules: string[];
    features: string[];
    price?: string;
    isCurrent?: boolean;
}
