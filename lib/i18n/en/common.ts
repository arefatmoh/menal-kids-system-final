export default {
  // Common
  search: "Search",
  filter: "Filter",
  refresh: "Refresh",
  category: "Category",
  size: "Size",
  color: "Color",
  price: "Price",
  stock: "Stock",
  quantity: "Quantity",
  status: "Status",
  allCategories: "All Categories",
  allStatus: "All Status",
  actions: "Actions",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  add: "Add",
  remove: "Remove",
  clear: "Clear",
  apply: "Apply",

  // Stock Status
  inStock: "In Stock",
  lowStock: "Low Stock",
  outOfStock: "Out of Stock",
  overstock: "Overstock",

  // Tabs / Sections
  overview: "Overview",
  operations: "Operations",
  alerts: "Alerts",
  history: "History",
  inventoryAnalytics: "Inventory Analytics",
  settings: "Settings",

  // Stock Page
  totalStocks: "Total Stocks",
  inventoryLevelsAcrossBranches: "Current inventory levels across all branches",
  
  // Inventory/General labels
  items: "items",
  searchAndFilters: "search & filters",
  crossBranchSearch: "cross-branch search",

  // Inventory empty states
  noProductsFoundTitle: "No products found",
  noProductsMatchFilters: "No products match your current filters",
  noProductsAddedYet: "No products have been added yet",
  
  // Table headers
  product: "Product",
  details: "Details",
  stockLevel: "Stock Level",
  branch: "Branch",
  allBranches: "All Branches",
  sellingPrice: "Selling Price",
  
  // Filter and search
  quickFilters: "Quick Filters:",
  
  // Cart and selection
  clearSelection: "Clear Selection",
  deleteSelected: "Delete Selected",
  deleting: "Deleting...",
  
  // Pagination
  showing: "Showing",
  to: "to",
  of: "of",
  results: "results",
  firstPage: "First page",
  previousPage: "Previous page",
  nextPage: "Next page",
  lastPage: "Last page",
  
  // Status labels
  completed: "Completed",
  pending: "Pending",
  loading: "Loading...",
  
  // Role labels
  owner: "Owner",
  employee: "Employee",
  
  // Sell page
  cart: "Cart",
  cartIsEmpty: "Cart is empty",
  addProductsToStartSale: "Add products to start a sale",
  continueSelling: "Continue Selling",
  startNewSale: "Start New Sale",
  completeSale: "Complete Sale",
  processing: "Processing...",
  original: "Original",
  savings: "Savings",
  total: "Total",
  units: "units",
  variations: "Variations",
  stockLimitReached: "Stock limit reached",
  onlyAvailable: "Only {0} available for this variation",
  notEnoughStock: "Not enough stock available",
  available: "Available",
  requested: "Requested",
  invalidPrice: "Invalid price",
  productPriceMustBeGreater: "Product price must be greater than 0",
  variationPriceMustBeGreater: "Variation price must be greater than 0",
  stockLimitReachedForVariation: "Only {0} available for this variation",
  saleCompletedSuccessfully: "Sale Completed Successfully!",
  inventoryUpdated: "Inventory updated",
  itemsSold: "Items Sold",
  saleSummary: "Sale Summary",
  qty: "Qty",
  each: "each",
  // History page
  recentActivities: "Recent Activities",
  // Filters
  allHistory: "All",
  sellHistory: "Sales",
  stockHistory: "Stock",
  expenseHistory: "Expenses",
  transferHistory: "Transfers",
  detail: "Detail",
  editActivity: "Edit Activity",
  restore: "Restore",
  restoring: "Restoring...",
  areYouSure: "Are you sure?",
  confirmRestore: "Do you want to restore this activity?",
  restoreLogged: "Restore logged",
  restoredSuccessfully: "Restored successfully",
  restoreFailed: "Restore failed",
  noData: "No activities",
  type: "Type",
  title: "Title",
  description: "Description",
  // status, date, actions already defined above
  user: "User",
  branchLabel: "Branch",
  delta: "Delta",
  meta: "Meta",
  dryRunPreview: "Preview impact only (no changes)",
  dryRunComplete: "Preview complete",
  seeDetailForMore: "Open details to inspect.",
  preview: "Preview",
  updated: "Updated",
  updateFailed: "Update failed",
  refundForSale: "Refund for sale",
  saleCompleted: "Sale completed",
  userRestoreFromHistory: "User restore from History",
  advanced: "Advanced (raw data)",
  rawDetail: "Raw detail",
  // confirm, cancel already defined above
  destinationUpdated: "Destination Updated",
  transferFailed: "Transfer Failed",
  couldNotCompleteTransfer: "Could not complete transfer. Please try again.",
  transferSubmissionError: "Failed to submit transfer",

  // Activity type labels (prefixed to avoid key collisions)
  type_sell: "Sale",
  type_stock_add: "Stock Added",
  type_stock_reduce: "Stock Reduced",
  type_expense_add: "Expense",
  type_transfer: "Transfer",
  type_refund: "Refund",
  type_restore: "Restore",
  type_edit_correction: "Edit Correction",
  type_product_create: "Product Created",
  type_product_update: "Product Updated",
  
  // Search and filter
  findProducts: "Find Products",
  searchProductsPlaceholder: "Search products by name, SKU, brand, or category...",
  lastUpdated: "Last updated",
  autoEvery10Min: "auto every 10 min",
  searchHelp: "Search Help: < 3 chars = Exact match, 3-5 chars = Partial match, 6+ chars = Phrase match",
  
  // Transfer page
  productSelection: "Product Selection",
  selectProductsToTransfer: "Select products to transfer from available inventory",
  branchSelection: "Branch Selection",
  fromBranch: "From Branch",
  toBranch: "To Branch",
  selectedItems: "Selected Items",
  readyToTransfer: "Ready to transfer",
  reason: "Reason",
  transferReason: "Transfer reason (optional)",
  submitTransfer: "Submit Transfer",
  submitting: "Submitting...",
  transferCompleted: "Transfer completed successfully!",
  transferSummary: "Transfer Summary",
  productsTransferred: "Products transferred",
  totalQuantity: "Total Quantity",
  destinationBranch: "Destination branch",
  discount: "Discount",
  
  // Product selection
  clickProductsToAddToCart: "Click on products to quickly add them to cart",
  selectProductsToStartSale: "Select products from the list below to start building your sale",
  
  // Transfer page specific
  branchTransfer: "Branch Transfer",
  transferDescription: "Transfer products between branches instantly - no approval needed",
  viewInventory: "View Inventory",
  totalTransfers: "Total Transfers",
  itemsTransferred: "Items Transferred",
  transferDescriptionSuccess: "Items have been transferred instantly between branches and inventory has been updated",
  transferDetails: "Transfer Details",
  transferred: "Transferred",
  continueTransferring: "Continue Transferring",
  startNewTransfer: "Start New Transfer",
  
  // Expense page specific
  expenses: "Expenses",
  addExpense: "Add Expense",
  editExpense: "Edit Expense",
  noExpensesFound: "No expenses found.",
  descriptionLabel: "Description",
  amount: "Amount",
  date: "Date",
  selectCategory: "Select Category",
  
  // Expense Categories
  rent: "Rent",
  salaries: "Salaries",
  utilities: "Utilities",
  marketing: "Marketing",
  supplies: "Supplies",
  other: "Other",
}


