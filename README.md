Everything, except this first paragraph of the README.md, was created by an AI. I did not write a single line of code by myself. So I don't know, how the app works internally. Use at your own risk. I should have learned something useful like cook, or mason, or something like that…

# Product Counter (PWA)

A lightweight Progressive Web App to import product lists (CSV), create templates, perform physical counts, and export or share results as CSV. Data is stored locally in the browser (localStorage).

## Features
- Import product templates from CSV files
- Create templates manually
- Counting UI with +1 / -1 and packaging-size adjustments
- Save counts locally and view history
- Export counts as CSV
- Share CSV via the Web Share API (on supported devices)
- Works offline as a client-side PWA

## CSV format for imports
CSV columns:
1. Product ID
2. Product Name
3. Packaging Size (number)
4. Sort Index (optional)

Example:
```
SKU001,Widget A,12,1
SKU002,Widget B,6,2
```

## Quick usage
1. Import a CSV or create a template under "Create Template".
2. Select a template and start counting.
3. Use the +1 / -1 buttons or packaging-size buttons to adjust counts.
4. Submit a count to save it locally.
5. From "View Counts" you can export CSVs or share them using the Share button (if supported).

## Data persistence
Templates and counts are stored in browser localStorage keys:
- productCounter_templates
- productCounter_counts

## Development
- Install: npm install
- Run locally: npm start
- Build: npm run build

Adjust commands to your project tooling (Vite/CRA/etc.).
