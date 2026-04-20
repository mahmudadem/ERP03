# Voucher Seeding Audit Document

This document outlines the field definitions and system rules for each ERP document type, grouped by classification for significantly better readability.

---

## 1. Accounting Module

### 📑 Journal Entry (JOURNAL)

#### 🟢 Core Fields (Mandatory & System Locked)
| Field ID        | Label           | Type            | Mandatory | Auto-Managed | Posting Role  |
| :---           | :---            | :---            | :---      | :---         | :---          |
| `date`         | Date            | DATE            | Yes       | No           | DATE          |
| `currency`     | Currency        | CURRENCY_SELECT | Yes       | No           | CURRENCY      |
| `exchangeRate` | Exchange Rate   | NUMBER          | Yes       | No           | EXCHANGE_RATE |
| `lineItems`    | Journal Lines   | TABLE           | Yes       | No           | -             |

#### 🔵 Shared Fields (Optional & Configurable)
| Field ID       | Label           | Type            | Mandatory | Auto-Managed |
| :---           | :---            | :---            | :---      | :---         |
| `reference`    | Reference       | TEXT            | No        | No           |
| `description`  | Description     | TEXT            | No        | No           |

---

### 📑 Payment Voucher (PAYMENT)

#### 🟢 Core Fields (Mandatory & System Locked)
| Field ID           | Label           | Type            | Mandatory | Auto-Managed | Posting Role  |
| :---               | :---            | :---            | :---      | :---         | :---          |
| `date`             | Date            | DATE            | Yes       | No           | DATE          |
| `payFromAccountId` | Paid From       | ACCOUNT_SELECT | Yes       | No           | ACCOUNT       |
| `currency`         | Currency        | CURRENCY_SELECT | Yes       | No           | CURRENCY      |
| `exchangeRate`     | Exchange Rate   | NUMBER          | Yes       | No           | EXCHANGE_RATE |
| `lineItems`        | Payment Lines   | TABLE           | Yes       | No           | -             |

#### 🔵 Shared Fields (Optional & Configurable)
| Field ID        | Label           | Type            | Mandatory | Auto-Managed |
| :---            | :---            | :---            | :---      | :---         |
| `description`   | Description     | TEXT            | No        | No           |

---

## 2. Sales Module

### 📑 Sales Order (sales_order)

#### 🟢 Core Fields (Mandatory & System Locked)
| Field ID       | Label           | Type            | Mandatory | Auto-Managed |
| :---           | :---            | :---            | :---      | :---         |
| `orderDate`    | Order Date      | DATE            | Yes       | No           |
| `customerId`   | Customer        | SELECT          | Yes       | No           |
| `currency`     | Currency        | CURRENCY_SELECT | Yes       | No           |
| `exchangeRate` | Exchange Rate   | NUMBER          | Yes       | No           |
| `lineItems`    | Items Table     | TABLE           | Yes       | No           |

#### 🔵 Shared Fields (Optional & Configurable)
| Field ID | Label          | Type | Mandatory | Auto-Managed |
| :---     | :---           | :--- | :---      | :---         |
| `notes`  | Internal Notes | TEXT | No        | No           |

---

### 📑 Sales Invoice (sales_invoice)

#### 🟢 Core Fields (Mandatory & System Locked)
| Field ID       | Label           | Type            | Mandatory | Auto-Managed | Posting Role  |
| :---           | :---            | :---            | :---      | :---         | :---          |
| `date`         | Invoice Date    | DATE            | Yes       | No           | DATE          |
| `customerId`   | Customer        | SELECT          | Yes       | No           | -             |
| `currency`     | Currency        | CURRENCY_SELECT | Yes       | No           | CURRENCY      |
| `exchangeRate` | Exchange Rate   | NUMBER          | Yes       | No           | EXCHANGE_RATE |
| `lineItems`    | Items Table     | TABLE           | Yes       | No           | -             |

#### 🔵 Shared Fields (Optional & Configurable)
| Field ID      | Label          | Type   | Mandatory | Auto-Managed |
| :---          | :---           | :---   | :---      | :---         |
| `totalAmount` | Total Amount   | NUMBER | No        | **Yes**      |
| `description` | Description    | TEXT   | No        | No           |

---

## 3. Purchase Module

### 📑 Purchase Order (purchase_order)

#### 🟢 Core Fields (Mandatory & System Locked)
| Field ID       | Label           | Type            | Mandatory | Auto-Managed |
| :---           | :---            | :---            | :---      | :---         |
| `orderDate`    | Order Date      | DATE            | Yes       | No           |
| `supplierId`   | Supplier        | SELECT          | Yes       | No           |
| `currency`     | Currency        | CURRENCY_SELECT | Yes       | No           |
| `exchangeRate` | Exchange Rate   | NUMBER          | Yes       | No           |
| `lineItems`    | Items Table     | TABLE           | Yes       | No           |

#### 🔵 Shared Fields (Optional & Configurable)
| Field ID | Label          | Type | Mandatory | Auto-Managed |
| :---     | :---           | :--- | :---      | :---         |
| `notes`  | Internal Notes | TEXT | No        | No           |

---

### 📑 Purchase Invoice (purchase_invoice)

#### 🟢 Core Fields (Mandatory & System Locked)
| Field ID       | Label           | Type            | Mandatory | Auto-Managed | Posting Role  |
| :---           | :---            | :---            | :---      | :---         | :---          |
| `date`         | Invoice Date    | DATE            | Yes       | No           | DATE          |
| `supplierId`   | Supplier        | SELECT          | Yes       | No           | -             |
| `currency`     | Currency        | CURRENCY_SELECT | Yes       | No           | CURRENCY      |
| `exchangeRate` | Exchange Rate   | NUMBER          | Yes       | No           | EXCHANGE_RATE |
| `lineItems`    | Items Table     | TABLE           | Yes       | No           | -             |

#### 🔵 Shared Fields (Optional & Configurable)
| Field ID      | Label          | Type   | Mandatory | Auto-Managed |
| :---          | :---           | :---   | :---      | :---         |
| `totalAmount` | Total Amount   | NUMBER | No        | **Yes**      |
| `description` | Description    | TEXT   | No        | No           |
