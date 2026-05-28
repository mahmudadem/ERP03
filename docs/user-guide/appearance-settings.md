# User Guide: Customizing the System Appearance

This guide explains how to personalize your ERP03 workspace appearance, select theme presets, adjust font sizes/types, customize layout density, and create custom brand colors.

## Accessing the Appearance Settings

To customize how the application looks:
1. Click on your **User Avatar** (located on the far right of the top navigation bar).
2. Select **Appearance** from the dropdown menu.
3. This opens the **Appearance Lab** page.

---

## 1. Choosing a Theme Preset
ERP03 ships with curated presets tailored to different work styles:
* **ERP Default**: High-contrast, clean blue-and-pink corporate theme.
* **Ledger**: Deep forest-green theme designed for accounting professionals.
* **Graphite**: Elegant dark theme built for low-light environments.
* **Executive**: Modern purple-and-teal theme with pronounced shadows.
* **High Contrast**: A fully flat black-and-white theme designed for accessibility.
* **Ocean Breeze**: Vibrant light-blue theme using geometric curves.
* **Tailwind Play**: An ultra-clean, minimalist slate-grey theme matching default modern designer grids.

To apply a preset, simply click on its card in the **Curated Presets** section.

---

## 2. Dynamic Settings & Fine-tuning
You can customize the layout structure, fonts, and depth rules independently:

### Typography
* **Font Family**: Select your preferred typeface. Options include *Inter (Modern & Clean)*, *Roboto (Classic UI)*, *Outfit (Geometric)*, *Cairo (Modern Arabic)*, *Monospace*, or *System Default*.
* **Corner Radius**: Use the slider to make card borders sharp (0px) or highly rounded (up to 24px).
* **Shadow Intensity**: Choose from *Flat* (flat borders), *Subtle* (default), *Pronounced*, or *Glassmorphism* (adds a soft glowing backdrop).

### Spacing & Spacing Density
* **UI Density**:
  * *Compact*: Minimizes spacing so you can see more rows on a ledger table or dashboard without scrolling.
  * *Comfortable*: The default layout spacing.
  * *Spacious*: Enlarges buttons and padding for touchscreens or high-resolution monitors.

### Navigation Sidebar Style
* **Sidebar Surface**:
  * *Default*: Matches the page surface (white).
  * *Contrast*: Uses your brand color as the background.
  * *Secondary*: Renders the sidebar with a subtle grey background to distinctively separate it from the main content.

### Sidebar Search & Quick Filter
* **Sidebar Search Bar:** A search box is located directly below the company header in the sidebar. Typing in this input will automatically filter the sidebar modules and options in real-time.
* **Focus Shortcut:** Press `Ctrl + G` (or `Cmd + G` on Mac) at any time to instantly focus the sidebar search input and begin typing.

### Glossy 3D Fluent Icons (Icon Parity)
* When you select the **Tailwind Play** theme preset, the system switches Lucide outline icons to high-quality **glossy 3D Fluent icons** (e.g. 🏠 for Home, 📦 for Inventory, and 💰 for Accounting).
* These icons render exactly as designed across all browsers and operating systems, creating a premium, modern experience.
* In collapsed sidebar mode, the active module icon box stands out as a crisp white card with a subtle border and shadow (`bg-white shadow-sm`), matching standard design specs.

### Visual Parity Sandbox Page (Developer Tool)
* **Sandbox Path:** A visual sandbox page is available at `/dev/tailwind-play-demo`.
* **Testing Theme Parity:** This page displays a realistic "Items Master" inventory table, an "Active" badge, "Actions" dropdown, and "+ New Item" creation controls.
* **Demonstration Seeding:** Click the **Actions** button and select **Seed Demo Data** on the sandbox page to instantly generate the exact Raw Steel Sheets dataset (1,200 pcs) shown in the styling design specification.

---

## 3. Creating a Custom Theme (Magic Generator)
If you want to use your company's official brand color:
1. Locate the **Auto-Theme Generator** card.
2. Select your color using the color picker block, or paste a hex color code (e.g., `#FF5733`).
3. Click the **Generate** button.
4. The system will automatically compute perfectly balanced Light Mode and Dark Mode palettes for you.

---

## 4. Saving Preferences
After selecting or designing your theme:
* Click **Save Preferences** on the top right.
* Your styling choice is saved to your account and will sync automatically across all your devices.
* Click **Reset to Default** at any time to return to the global system theme.
