# Currency Exchange Rates and New Invoice Action

This guide explains how to use the redesigned Currency Exchange Rate widget and the new footer action buttons on the Sales Invoice detail page.

---

## 1. Redesigned Currency Exchange Rate Widget

The Currency Exchange Rate widget has been redesigned to be compact and premium. It displays all essential currency details directly inside a high-density, single-row component (`h-9` height) within the invoice header section.

### Features
* **Dual Input Fields:** You can view and edit both **Parity** and **Equivalent** rates directly side-by-side inside the widget.
* **Bi-directional Calculation:** Changing either value will automatically calculate the other rate:
  * Entering a new **Parity** rate automatically updates the **Equivalent** rate ($\text{equivalent} = 1 / \text{parity}$).
  * Entering a new **Equivalent** rate automatically updates the **Parity** rate ($\text{parity} = 1 / \text{equivalent}$).
* **Base Currency Parity:** If the document currency is the same as your company's base currency, the inputs are replaced with a single read-only green indicator: `🟢 1 [CURRENCY] = 1.0000 [BASE] (Base Currency Parity)`.
* **Interactive Status Indicator:**
  * **Green Dot (`🟢`) / Refresh Icon:** Shows that the rate matches the system-configured rate.
  * **Blue Dot (`🔵`) / Warning Icon:** Indicates a manual override rate has been entered.
  * **Resetting:** Clicking on the status indicator resets a manually entered rate back to the default system rate. If the rate is already compliant, clicking it fetches the latest system rate.
  * **Warnings:** If your manually entered rate deviates by 10% or more from the system rate, a warning modal will prompt you to confirm the deviation before applying it.

### Arabic (RTL) Layout Alignment
When the user language is set to Arabic, the layout naturally flows Right-to-Left (RTL). To ensure the interface remains clean and aligned with accounting practices:
* The placement of the **Currency Selector** and the **Exchange Rate widget** is automatically swapped in the DOM.
* This places the **Currency Selector** on the **left side** of the Exchange Rate widget in Arabic RTL, keeping it clean and easy to scan.

---

## 2. Footer "New" Button Action

To improve navigation speed when creating multiple invoices in sequence:
* A text button labeled **"New"** is available in the bottom action bar (footer).
* This button is located next to the standard save/post buttons. It performs the exact same action as the small "+" icon button in the top tray.
* **Data Protection Guard:** Clicking the "New" button triggers a "dirty check". If you have entered data or made edits on the current invoice form, a confirmation dialog will appear warning that unsaved changes will be lost. If you confirm, or if the form is empty, the page resets to a blank draft invoice immediately.
