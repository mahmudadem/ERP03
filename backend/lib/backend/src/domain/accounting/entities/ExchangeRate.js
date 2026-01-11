"use strict";
/**
 * Exchange Rate Entity
 *
 * Represents a stored exchange rate for a specific date.
 * Multiple rates per (company, pair, date) are allowed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRate = void 0;
class ExchangeRate {
    constructor(props) {
        if (props.rate <= 0) {
            throw new Error('Exchange rate must be positive');
        }
        if (!props.fromCurrency || !props.toCurrency) {
            throw new Error('Currency codes are required');
        }
        this.id = props.id;
        this.companyId = props.companyId;
        this.fromCurrency = props.fromCurrency.toUpperCase();
        this.toCurrency = props.toCurrency.toUpperCase();
        this.rate = props.rate;
        this.date = props.date;
        this.source = props.source;
        this.createdAt = props.createdAt;
        this.createdBy = props.createdBy;
    }
    /**
     * Date as ISO date string (YYYY-MM-DD)
     */
    get dateString() {
        return this.date.toISOString().split('T')[0];
    }
    /**
     * Check if this rate is for the same currency pair
     */
    isSamePair(fromCurrency, toCurrency) {
        return (this.fromCurrency === fromCurrency.toUpperCase() &&
            this.toCurrency === toCurrency.toUpperCase());
    }
    toJSON() {
        return {
            id: this.id,
            companyId: this.companyId,
            fromCurrency: this.fromCurrency,
            toCurrency: this.toCurrency,
            rate: this.rate,
            date: this.date,
            source: this.source,
            createdAt: this.createdAt,
            createdBy: this.createdBy,
        };
    }
    static fromJSON(data) {
        return new ExchangeRate(Object.assign(Object.assign({}, data), { date: new Date(data.date), createdAt: new Date(data.createdAt) }));
    }
}
exports.ExchangeRate = ExchangeRate;
//# sourceMappingURL=ExchangeRate.js.map