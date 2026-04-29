"use strict";
/**
 * Currency Value Object
 *
 * Represents a global currency with fixed properties.
 * Companies can enable/disable currencies but cannot modify their properties.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Currency = void 0;
class Currency {
    constructor(props) {
        if (!props.code || props.code.length !== 3) {
            throw new Error('Currency code must be a 3-letter ISO 4217 code');
        }
        if (props.decimalPlaces < 0 || props.decimalPlaces > 4) {
            throw new Error('Currency decimalPlaces must be between 0 and 4');
        }
        this.code = props.code.toUpperCase();
        this.name = props.name;
        this.symbol = props.symbol;
        this.decimalPlaces = props.decimalPlaces;
        this.isActive = props.isActive;
    }
    /**
     * Round a monetary value according to this currency's precision
     */
    roundAmount(value) {
        const factor = Math.pow(10, this.decimalPlaces);
        return Math.round(value * factor) / factor;
    }
    /**
     * Format a monetary value for display
     */
    formatAmount(value) {
        return value.toFixed(this.decimalPlaces);
    }
    toJSON() {
        return {
            code: this.code,
            name: this.name,
            symbol: this.symbol,
            decimalPlaces: this.decimalPlaces,
            isActive: this.isActive,
        };
    }
    static fromJSON(data) {
        return new Currency(data);
    }
}
exports.Currency = Currency;
//# sourceMappingURL=Currency.js.map