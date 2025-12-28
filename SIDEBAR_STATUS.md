# Sidebar Mode Implementation Details

I have completed the sidebar refactor. Since the artifact dashboard seems to be showing empty files on your end, here is the summary:

### 1. New Mode: Sub-Menus
Main modules now trigger a flyout menu instead of expanding inline. This keeps the sidebar clean and allows for faster navigation.

### 2. Recursive Flyouts
Nested items also support flyouts, ensuring that even complex modules like Accounting (with its dynamic voucher list) are fully navigable.

### 3. Dynamic Icons
The system now resolves icon names like 'Calculator', 'Boxes', and 'Settings' automatically into Lucide icons for a premium look.

### 4. How to switch
Toggle the style in **Company Admin > Settings > UI Customization**.
