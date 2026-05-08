const { pool } = require('./database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// ── INDUSTRY DEFINITIONS ──────────────────────────────────────────────────────
const INDUSTRIES = [
  { name: 'Manufacturing', slug: 'manufacturing', description: 'End-to-end manufacturing operations' },
  { name: 'Production',    slug: 'production',    description: 'Job and production management' },
  { name: 'Warehousing',        slug: 'warehousing',        description: 'Storage and warehouse logistics' },
  { name: 'Hotel & Restaurant', slug: 'hotel_restaurant',   description: 'Hospitality and food service management' },
];

// ── MODULE DEFINITIONS ────────────────────────────────────────────────────────
const MODULES = [
  { name: 'Dashboard',   slug: 'dashboard',   icon: 'LayoutDashboard', sort_order: 0 },
  { name: 'CRM',         slug: 'crm',         icon: 'Users',           sort_order: 1 },
  { name: 'Sales',       slug: 'sales',       icon: 'TrendingUp',      sort_order: 2 },
  { name: 'Purchase',    slug: 'purchase',    icon: 'ShoppingCart',    sort_order: 3 },
  { name: 'Production',  slug: 'production',  icon: 'Factory',         sort_order: 4 },
  { name: 'Job',         slug: 'job',         icon: 'Briefcase',       sort_order: 5 },
  { name: 'Storage',     slug: 'storage',     icon: 'Archive',         sort_order: 6 },
  { name: 'Warehouse',   slug: 'warehouse',   icon: 'Warehouse',       sort_order: 7 },
  { name: 'Inventory',   slug: 'inventory',   icon: 'Package',         sort_order: 8 },
  { name: 'Billing',     slug: 'billing',     icon: 'FileText',        sort_order: 9 },
  { name: 'Reports',       slug: 'reports',       icon: 'BarChart2',       sort_order: 10 },
  { name: 'Rooms',         slug: 'rooms',         icon: 'BedDouble',       sort_order: 11 },
  { name: 'Bookings',      slug: 'bookings',      icon: 'CalendarCheck',   sort_order: 12 },
  { name: 'Menu',          slug: 'menu',          icon: 'UtensilsCrossed', sort_order: 13 },
  { name: 'Housekeeping',  slug: 'housekeeping',  icon: 'Sparkles',        sort_order: 14 },
  { name: 'Transport',     slug: 'transport',     icon: 'Car',             sort_order: 15 },
];

// ── INDUSTRY → MODULE CHAINS ──────────────────────────────────────────────────
const INDUSTRY_MODULES = {
  manufacturing: ['dashboard','crm','sales','purchase','production','inventory','billing','reports'],
  production:    ['dashboard','crm','job','inventory','billing','reports'],
  warehousing:      ['dashboard','crm','storage','warehouse','inventory','billing','reports'],
  hotel_restaurant: ['dashboard','crm','rooms','bookings','menu','inventory','housekeeping','transport','billing','reports'],
};

// ── TITLE HEADS per industry per module ───────────────────────────────────────
// Format: { industry_slug: { module_slug: [ {name, label, field_type, options?, is_required?} ] } }
const TITLE_HEADS = {

  // ════════════════════════════════════════════════════════
  // MANUFACTURING
  // ════════════════════════════════════════════════════════
  manufacturing: {
    crm: [
      { name: 'company_name',  label: 'Company Name',  field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'contact_name',  label: 'Contact Name',  field_type: 'text',     is_required: true,  sort_order: 2 },
      { name: 'phone',         label: 'Phone',         field_type: 'phone',                        sort_order: 3 },
      { name: 'email',         label: 'Email',         field_type: 'email',                        sort_order: 4 },
      { name: 'lead_source',   label: 'Lead Source',   field_type: 'dropdown', sort_order: 5,
        options: [
          {label:'Website',value:'website'},{label:'Referral',value:'referral'},
          {label:'Cold Call',value:'cold_call'},{label:'Exhibition',value:'exhibition'},
          {label:'Social Media',value:'social_media'},
        ]},
      { name: 'status',        label: 'Status',        field_type: 'dropdown', is_required: true,  sort_order: 6,
        options: [
          {label:'New',value:'new'},{label:'Contacted',value:'contacted'},
          {label:'Qualified',value:'qualified'},{label:'Converted',value:'converted'},
          {label:'Lost',value:'lost'},
        ]},
      { name: 'product_interest', label: 'Product Interest', field_type: 'text', sort_order: 7 },
      { name: 'estimated_value',  label: 'Estimated Value',  field_type: 'currency', sort_order: 8 },
      { name: 'assigned_to',      label: 'Assigned To',      field_type: 'text',     sort_order: 9 },
      { name: 'address',          label: 'Address',          field_type: 'textarea', sort_order: 10 },
      { name: 'remarks',          label: 'Remarks',          field_type: 'textarea', sort_order: 11 },
    ],
    sales: [
      { name: 'customer_name',   label: 'Customer Name',    field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'order_number',    label: 'Order Number',     field_type: 'text',     sort_order: 2 },
      { name: 'product',         label: 'Product',          field_type: 'text',     is_required: true, sort_order: 3 },
      { name: 'quantity',        label: 'Quantity',         field_type: 'number',   is_required: true, sort_order: 4 },
      { name: 'unit_price',      label: 'Unit Price',       field_type: 'currency', sort_order: 5 },
      { name: 'total_value',     label: 'Total Value',      field_type: 'currency', sort_order: 6 },
      { name: 'delivery_date',   label: 'Delivery Date',    field_type: 'date',     sort_order: 7 },
      { name: 'status',          label: 'Status',           field_type: 'dropdown', is_required: true, sort_order: 8,
        options: [
          {label:'Draft',value:'draft'},{label:'Confirmed',value:'confirmed'},
          {label:'In Production',value:'in_production'},{label:'Delivered',value:'delivered'},
          {label:'Cancelled',value:'cancelled'},
        ]},
      { name: 'payment_terms',   label: 'Payment Terms',    field_type: 'text',     sort_order: 9 },
      { name: 'remarks',         label: 'Remarks',          field_type: 'textarea', sort_order: 10 },
    ],
    purchase: [
      { name: 'vendor_name',      label: 'Vendor Name',       field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'item',             label: 'Item / Material',    field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'quantity',         label: 'Quantity',           field_type: 'number',   is_required: true, sort_order: 3 },
      { name: 'unit_cost',        label: 'Unit Cost',          field_type: 'currency', sort_order: 4 },
      { name: 'total_cost',       label: 'Total Cost',         field_type: 'currency', sort_order: 5 },
      { name: 'order_date',       label: 'Order Date',         field_type: 'date',     sort_order: 6 },
      { name: 'expected_delivery',label: 'Expected Delivery',  field_type: 'date',     sort_order: 7 },
      { name: 'status',           label: 'Status',             field_type: 'dropdown', is_required: true, sort_order: 8,
        options: [
          {label:'Requested',value:'requested'},{label:'Ordered',value:'ordered'},
          {label:'Received',value:'received'},{label:'Cancelled',value:'cancelled'},
        ]},
      { name: 'vendor_contact',   label: 'Vendor Contact',     field_type: 'phone',    sort_order: 9 },
      { name: 'remarks',          label: 'Remarks',            field_type: 'textarea', sort_order: 10 },
    ],
    production: [
      { name: 'job_number',      label: 'Job Number',       field_type: 'text',     sort_order: 1 },
      { name: 'product_name',    label: 'Product Name',     field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'quantity',        label: 'Quantity',         field_type: 'number',   is_required: true, sort_order: 3 },
      { name: 'material_required', label: 'Material Required', field_type: 'textarea', sort_order: 4 },
      { name: 'start_date',      label: 'Start Date',       field_type: 'date',     sort_order: 5 },
      { name: 'end_date',        label: 'End Date',         field_type: 'date',     sort_order: 6 },
      { name: 'status',          label: 'Status',           field_type: 'dropdown', is_required: true, sort_order: 7,
        options: [
          {label:'Scheduled',value:'scheduled'},{label:'In Progress',value:'in_progress'},
          {label:'Complete',value:'complete'},{label:'On Hold',value:'on_hold'},
          {label:'Cancelled',value:'cancelled'},
        ]},
      { name: 'assigned_to',     label: 'Assigned To',      field_type: 'text',     sort_order: 8 },
      { name: 'remarks',         label: 'Remarks',          field_type: 'textarea', sort_order: 9 },
    ],
    inventory: [
      { name: 'item_name',    label: 'Item Name',      field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'sku',          label: 'SKU',            field_type: 'text',     sort_order: 2 },
      { name: 'category',     label: 'Category',       field_type: 'text',     sort_order: 3 },
      { name: 'quantity',     label: 'Quantity In Stock', field_type: 'number', is_required: true, sort_order: 4 },
      { name: 'reorder_level',label: 'Reorder Level',  field_type: 'number',   sort_order: 5 },
      { name: 'unit',         label: 'Unit',           field_type: 'dropdown', sort_order: 6,
        options: [{label:'Pcs',value:'pcs'},{label:'Kg',value:'kg'},{label:'Ltr',value:'ltr'},{label:'Box',value:'box'},{label:'Set',value:'set'}]},
      { name: 'location',     label: 'Storage Location', field_type: 'text',   sort_order: 7 },
      { name: 'unit_cost',    label: 'Unit Cost',      field_type: 'currency', sort_order: 8 },
      { name: 'last_updated', label: 'Last Updated',   field_type: 'date',     sort_order: 9 },
      { name: 'remarks',      label: 'Remarks',        field_type: 'textarea', sort_order: 10 },
    ],
    billing: [
      { name: 'invoice_number', label: 'Invoice Number',  field_type: 'text',     sort_order: 1 },
      { name: 'customer_name',  label: 'Customer Name',   field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'amount',         label: 'Amount',          field_type: 'currency', is_required: true, sort_order: 3 },
      { name: 'tax',            label: 'Tax (%)',         field_type: 'number',   sort_order: 4 },
      { name: 'total',          label: 'Total Amount',    field_type: 'currency', sort_order: 5 },
      { name: 'due_date',       label: 'Due Date',        field_type: 'date',     sort_order: 6 },
      { name: 'payment_status', label: 'Payment Status',  field_type: 'dropdown', is_required: true, sort_order: 7,
        options: [
          {label:'Unpaid',value:'unpaid'},{label:'Partial',value:'partial'},
          {label:'Paid',value:'paid'},{label:'Overdue',value:'overdue'},
        ]},
      { name: 'payment_date',   label: 'Payment Date',    field_type: 'date',     sort_order: 8 },
      { name: 'payment_method', label: 'Payment Method',  field_type: 'dropdown', sort_order: 9,
        options: [{label:'Bank Transfer',value:'bank'},{label:'Cash',value:'cash'},{label:'Cheque',value:'cheque'},{label:'UPI',value:'upi'}]},
      { name: 'remarks',        label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
      { name: 'discount',       label: 'Discount Amount', field_type: 'currency', sort_order: 11 },
      { name: 'final_total',    label: 'Final Total',     field_type: 'currency', sort_order: 12 },
      { name: 'remarks',        label: 'Remarks',         field_type: 'textarea', sort_order: 13 },
    ],
   
    reports: [
      { name: 'report_type',  label: 'Report Type',  field_type: 'dropdown', is_required: true, sort_order: 1,
        options: [{label:'Sales Summary',value:'sales_summary'},{label:'Production Summary',value:'production_summary'},{label:'Purchase Summary',value:'purchase_summary'},{label:'Billing Summary',value:'billing_summary'},{label:'Inventory Status',value:'inventory_status'}]},
      { name: 'period_from',  label: 'Period From',  field_type: 'date',     is_required: true, sort_order: 2 },
      { name: 'period_to',    label: 'Period To',    field_type: 'date',     is_required: true, sort_order: 3 },
      { name: 'total_value',  label: 'Total Value',  field_type: 'currency', sort_order: 4 },
      { name: 'record_count', label: 'Record Count', field_type: 'number',   sort_order: 5 },
      { name: 'notes',        label: 'Notes',        field_type: 'textarea', sort_order: 6 },
    ],
  },

  // ════════════════════════════════════════════════════════
  // PRODUCTION
  // ════════════════════════════════════════════════════════
  production: {
    crm: [
      { name: 'company_name',   label: 'Company Name',    field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'contact_name',   label: 'Contact Name',    field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'phone',          label: 'Phone',           field_type: 'phone',    sort_order: 3 },
      { name: 'email',          label: 'Email',           field_type: 'email',    sort_order: 4 },
      { name: 'job_type',       label: 'Job Type',        field_type: 'text',     sort_order: 5 },
      { name: 'status',         label: 'Status',          field_type: 'dropdown', is_required: true, sort_order: 6,
        options: [
          {label:'New',value:'new'},{label:'Contacted',value:'contacted'},
          {label:'Qualified',value:'qualified'},{label:'Converted',value:'converted'},
          {label:'Lost',value:'lost'},
        ]},
      { name: 'estimated_value', label: 'Estimated Value', field_type: 'currency', sort_order: 7 },
      { name: 'deadline',       label: 'Expected Deadline', field_type: 'date',   sort_order: 8 },
      { name: 'assigned_to',    label: 'Assigned To',     field_type: 'text',     sort_order: 9 },
      { name: 'remarks',        label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    job: [
      { name: 'job_number',    label: 'Job Number',      field_type: 'text',     sort_order: 1 },
      { name: 'job_title',     label: 'Job Title',       field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'client_name',   label: 'Client Name',     field_type: 'text',     is_required: true, sort_order: 3 },
      { name: 'description',   label: 'Description',     field_type: 'textarea', sort_order: 4 },
      { name: 'quantity',      label: 'Quantity',        field_type: 'number',   sort_order: 5 },
      { name: 'start_date',    label: 'Start Date',      field_type: 'date',     sort_order: 6 },
      { name: 'end_date',      label: 'End Date',        field_type: 'date',     sort_order: 7 },
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true, sort_order: 8,
        options: [
          {label:'Pending',value:'pending'},{label:'In Progress',value:'in_progress'},
          {label:'Complete',value:'complete'},{label:'On Hold',value:'on_hold'},
          {label:'Cancelled',value:'cancelled'},
        ]},
      { name: 'assigned_to',   label: 'Assigned To',     field_type: 'text',     sort_order: 9 },
      { name: 'cost',          label: 'Job Cost',        field_type: 'currency', sort_order: 10 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 11 },
    ],
    inventory: [
      { name: 'item_name',     label: 'Item Name',       field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'sku',           label: 'SKU',             field_type: 'text',     sort_order: 2 },
      { name: 'quantity',      label: 'Quantity',        field_type: 'number',   is_required: true, sort_order: 3 },
      { name: 'reorder_level', label: 'Reorder Level',   field_type: 'number',   sort_order: 4 },
      { name: 'unit',          label: 'Unit',            field_type: 'dropdown', sort_order: 5,
        options: [{label:'Pcs',value:'pcs'},{label:'Kg',value:'kg'},{label:'Ltr',value:'ltr'},{label:'Box',value:'box'}]},
      { name: 'location',      label: 'Storage Location', field_type: 'text',    sort_order: 6 },
      { name: 'unit_cost',     label: 'Unit Cost',       field_type: 'currency', sort_order: 7 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 8 },
    ],
    billing: [
      { name: 'invoice_number', label: 'Invoice Number',  field_type: 'text',     sort_order: 1 },
      { name: 'client_name',    label: 'Client Name',     field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'job_reference',  label: 'Job Reference',   field_type: 'text',     sort_order: 3 },
      { name: 'amount',         label: 'Amount',          field_type: 'currency', is_required: true, sort_order: 4 },
      { name: 'tax',            label: 'Tax (%)',         field_type: 'number',   sort_order: 5 },
      { name: 'total',          label: 'Total Amount',    field_type: 'currency', sort_order: 6 },
      { name: 'due_date',       label: 'Due Date',        field_type: 'date',     sort_order: 7 },
      { name: 'payment_status', label: 'Payment Status',  field_type: 'dropdown', is_required: true, sort_order: 8,
        options: [{label:'Unpaid',value:'unpaid'},{label:'Partial',value:'partial'},{label:'Paid',value:'paid'},{label:'Overdue',value:'overdue'}]},
      { name: 'payment_date',   label: 'Payment Date',    field_type: 'date',     sort_order: 9 },
      { name: 'remarks',        label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    reports: [
      { name: 'report_type',  label: 'Report Type',  field_type: 'dropdown', is_required: true, sort_order: 1,
        options: [{label:'Job Summary',value:'job_summary'},{label:'Billing Summary',value:'billing_summary'},{label:'Inventory Status',value:'inventory_status'}]},
      { name: 'period_from',  label: 'Period From',  field_type: 'date',     is_required: true, sort_order: 2 },
      { name: 'period_to',    label: 'Period To',    field_type: 'date',     is_required: true, sort_order: 3 },
      { name: 'total_value',  label: 'Total Value',  field_type: 'currency', sort_order: 4 },
      { name: 'record_count', label: 'Record Count', field_type: 'number',   sort_order: 5 },
      { name: 'notes',        label: 'Notes',        field_type: 'textarea', sort_order: 6 },
    ],
  },

  // ════════════════════════════════════════════════════════
  // WAREHOUSING
  // ════════════════════════════════════════════════════════
  warehousing: {
    crm: [
      { name: 'company_name',  label: 'Company Name',   field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'contact_name',  label: 'Contact Name',   field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'phone',         label: 'Phone',          field_type: 'phone',    sort_order: 3 },
      { name: 'email',         label: 'Email',          field_type: 'email',    sort_order: 4 },
      { name: 'storage_need',  label: 'Storage Need',   field_type: 'text',     sort_order: 5 },
      { name: 'status',        label: 'Status',         field_type: 'dropdown', is_required: true, sort_order: 6,
        options: [
          {label:'New',value:'new'},{label:'Contacted',value:'contacted'},
          {label:'Qualified',value:'qualified'},{label:'Converted',value:'converted'},
          {label:'Lost',value:'lost'},
        ]},
      { name: 'estimated_volume', label: 'Estimated Volume (CBM)', field_type: 'number', sort_order: 7 },
      { name: 'contract_value',   label: 'Contract Value',         field_type: 'currency', sort_order: 8 },
      { name: 'assigned_to',   label: 'Assigned To',   field_type: 'text',     sort_order: 9 },
      { name: 'address',       label: 'Client Address', field_type: 'textarea', sort_order: 10 },
      { name: 'remarks',       label: 'Remarks',        field_type: 'textarea', sort_order: 11 },
    ],
    storage: [
      { name: 'client_name',   label: 'Client Name',    field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'item_description', label: 'Item Description', field_type: 'textarea', is_required: true, sort_order: 2 },
      { name: 'quantity',      label: 'Quantity',        field_type: 'number',   is_required: true, sort_order: 3 },
      { name: 'unit',          label: 'Unit',            field_type: 'dropdown', sort_order: 4,
        options: [{label:'Pcs',value:'pcs'},{label:'Kg',value:'kg'},{label:'Pallet',value:'pallet'},{label:'CBM',value:'cbm'},{label:'Box',value:'box'}]},
      { name: 'storage_zone',  label: 'Storage Zone',    field_type: 'text',     sort_order: 5 },
      { name: 'rack_number',   label: 'Rack / Bay',      field_type: 'text',     sort_order: 6 },
      { name: 'in_date',       label: 'Date In',         field_type: 'date',     sort_order: 7 },
      { name: 'out_date',      label: 'Date Out',        field_type: 'date',     sort_order: 8 },
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true, sort_order: 9,
        options: [{label:'Stored',value:'stored'},{label:'Dispatched',value:'dispatched'},{label:'Reserved',value:'reserved'}]},
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    warehouse: [
      { name: 'movement_type', label: 'Movement Type',   field_type: 'dropdown', is_required: true, sort_order: 1,
        options: [{label:'Inbound',value:'inbound'},{label:'Outbound',value:'outbound'},{label:'Transfer',value:'transfer'},{label:'Return',value:'return'}]},
      { name: 'item_name',     label: 'Item Name',       field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'quantity',      label: 'Quantity',        field_type: 'number',   is_required: true, sort_order: 3 },
      { name: 'from_location', label: 'From Location',   field_type: 'text',     sort_order: 4 },
      { name: 'to_location',   label: 'To Location',     field_type: 'text',     sort_order: 5 },
      { name: 'vehicle_number',label: 'Vehicle Number',  field_type: 'text',     sort_order: 6 },
      { name: 'driver_name',   label: 'Driver Name',     field_type: 'text',     sort_order: 7 },
      { name: 'movement_date', label: 'Movement Date',   field_type: 'date',     sort_order: 8 },
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true, sort_order: 9,
        options: [{label:'Pending',value:'pending'},{label:'In Transit',value:'in_transit'},{label:'Complete',value:'complete'},{label:'Cancelled',value:'cancelled'}]},
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    inventory: [
      { name: 'item_name',     label: 'Item Name',       field_type: 'text',     is_required: true, sort_order: 1 },
      { name: 'sku',           label: 'SKU / Barcode',   field_type: 'text',     sort_order: 2 },
      { name: 'client_name',   label: 'Client Name',     field_type: 'text',     sort_order: 3 },
      { name: 'quantity',      label: 'Quantity',        field_type: 'number',   is_required: true, sort_order: 4 },
      { name: 'unit',          label: 'Unit',            field_type: 'dropdown', sort_order: 5,
        options: [{label:'Pcs',value:'pcs'},{label:'Kg',value:'kg'},{label:'Pallet',value:'pallet'},{label:'Box',value:'box'}]},
      { name: 'zone',          label: 'Zone',            field_type: 'text',     sort_order: 6 },
      { name: 'rack',          label: 'Rack / Bay',      field_type: 'text',     sort_order: 7 },
      { name: 'reorder_level', label: 'Reorder Level',   field_type: 'number',   sort_order: 8 },
      { name: 'last_movement', label: 'Last Movement',   field_type: 'date',     sort_order: 9 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    billing: [
      { name: 'invoice_number',  label: 'Invoice Number',   field_type: 'text',     sort_order: 1 },
      { name: 'client_name',     label: 'Client Name',      field_type: 'text',     is_required: true, sort_order: 2 },
      { name: 'service_type',    label: 'Service Type',     field_type: 'dropdown', sort_order: 3,
        options: [{label:'Storage',value:'storage'},{label:'Handling',value:'handling'},{label:'Transport',value:'transport'},{label:'Combined',value:'combined'}]},
      { name: 'amount',          label: 'Amount',           field_type: 'currency', is_required: true, sort_order: 4 },
      { name: 'tax',             label: 'Tax (%)',          field_type: 'number',   sort_order: 5 },
      { name: 'total',           label: 'Total Amount',     field_type: 'currency', sort_order: 6 },
      { name: 'due_date',        label: 'Due Date',         field_type: 'date',     sort_order: 7 },
      { name: 'payment_status',  label: 'Payment Status',   field_type: 'dropdown', is_required: true, sort_order: 8,
        options: [{label:'Unpaid',value:'unpaid'},{label:'Partial',value:'partial'},{label:'Paid',value:'paid'},{label:'Overdue',value:'overdue'}]},
      { name: 'payment_date',    label: 'Payment Date',     field_type: 'date',     sort_order: 9 },
      { name: 'remarks',         label: 'Remarks',          field_type: 'textarea', sort_order: 10 },
    ],
    reports: [
      { name: 'report_type',  label: 'Report Type',  field_type: 'dropdown', is_required: true, sort_order: 1,
        options: [{label:'Storage Summary',value:'storage_summary'},{label:'Warehouse Movement',value:'warehouse_movement'},{label:'Billing Summary',value:'billing_summary'},{label:'Inventory Status',value:'inventory_status'}]},
      { name: 'period_from',  label: 'Period From',  field_type: 'date',     is_required: true, sort_order: 2 },
      { name: 'period_to',    label: 'Period To',    field_type: 'date',     is_required: true, sort_order: 3 },
      { name: 'total_value',  label: 'Total Value',  field_type: 'currency', sort_order: 4 },
      { name: 'record_count', label: 'Record Count', field_type: 'number',   sort_order: 5 },
      { name: 'notes',        label: 'Notes',        field_type: 'textarea', sort_order: 6 },
    ],
  },


// ════════════════════════════════════════════════════════
  // HOTEL & RESTAURANT
  // ════════════════════════════════════════════════════════
  hotel_restaurant: {
    crm: [
      { name: 'guest_name',    label: 'Guest Name',      field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'phone',         label: 'Phone',           field_type: 'phone',                        sort_order: 2 },
      { name: 'email',         label: 'Email',           field_type: 'email',                        sort_order: 3 },
      { name: 'lead_source',   label: 'Lead Source',     field_type: 'dropdown', sort_order: 4,
        options: [{label:'Walk-in',value:'walk_in'},{label:'OTA',value:'ota'},{label:'Phone',value:'phone'},{label:'Website',value:'website'},{label:'Referral',value:'referral'}]},
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true,  sort_order: 5,
        options: [{label:'New',value:'new'},{label:'Contacted',value:'contacted'},{label:'Converted',value:'converted'},{label:'Lost',value:'lost'}]},
      { name: 'nationality',   label: 'Nationality',     field_type: 'text',     sort_order: 6 },
      { name: 'id_type',       label: 'ID Type',         field_type: 'dropdown', sort_order: 7,
        options: [{label:'Passport',value:'passport'},{label:'Aadhaar',value:'aadhaar'},{label:'PAN',value:'pan'},{label:'Driving Licence',value:'driving_licence'}]},
      { name: 'id_number',     label: 'ID Number',       field_type: 'text',     sort_order: 8 },
      { name: 'assigned_to',   label: 'Assigned To',     field_type: 'text',     sort_order: 9 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    rooms: [
      { name: 'room_number',   label: 'Room Number',     field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'room_type',     label: 'Room Type',       field_type: 'dropdown', is_required: true,  sort_order: 2,
        options: [{label:'Standard',value:'standard'},{label:'Deluxe',value:'deluxe'},{label:'Suite',value:'suite'},{label:'Executive',value:'executive'},{label:'Family',value:'family'}]},
      { name: 'floor',         label: 'Floor',           field_type: 'text',     sort_order: 3 },
      { name: 'capacity',      label: 'Capacity (Persons)', field_type: 'number', sort_order: 4 },
      { name: 'rate_per_night',label: 'Rate Per Night',  field_type: 'currency', is_required: true,  sort_order: 5 },
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true,  sort_order: 6,
        options: [{label:'Vacant',value:'vacant'},{label:'Occupied',value:'occupied'},{label:'Reserved',value:'reserved'},{label:'Under Maintenance',value:'under_maintenance'},{label:'Housekeeping',value:'housekeeping'}]},
      { name: 'bed_type',      label: 'Bed Type',        field_type: 'dropdown', sort_order: 7,
        options: [{label:'Single',value:'single'},{label:'Double',value:'double'},{label:'Twin',value:'twin'},{label:'King',value:'king'},{label:'Queen',value:'queen'}]},
      { name: 'amenities',     label: 'Amenities',       field_type: 'textarea', sort_order: 8 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 9 },
    ],
    bookings: [
      { name: 'booking_number', label: 'Booking Number', field_type: 'text',     sort_order: 1 },
      { name: 'guest_name',    label: 'Guest Name',      field_type: 'text',     is_required: true,  sort_order: 2 },
      { name: 'phone',         label: 'Phone',           field_type: 'phone',    sort_order: 3 },
      { name: 'email',         label: 'Email',           field_type: 'email',    sort_order: 4 },
      { name: 'room_number',   label: 'Room Number',     field_type: 'text',     is_required: true,  sort_order: 5 },
      { name: 'room_type',     label: 'Room Type',       field_type: 'dropdown', sort_order: 6,
        options: [{label:'Standard',value:'standard'},{label:'Deluxe',value:'deluxe'},{label:'Suite',value:'suite'},{label:'Executive',value:'executive'},{label:'Family',value:'family'}]},
      { name: 'check_in_date', label: 'Check-In Date',   field_type: 'date',     is_required: true,  sort_order: 7 },
      { name: 'check_out_date',label: 'Check-Out Date',  field_type: 'date',     is_required: true,  sort_order: 8 },
      { name: 'num_guests',    label: 'No. of Guests',   field_type: 'number',   sort_order: 9 },
      { name: 'rate_per_night',label: 'Rate Per Night',  field_type: 'currency', sort_order: 10 },
      { name: 'total_nights',  label: 'Total Nights',    field_type: 'number',   sort_order: 11 },
      { name: 'room_amount',   label: 'Room Amount',     field_type: 'currency', sort_order: 12 },
      { name: 'booking_source',label: 'Booking Source',  field_type: 'dropdown', sort_order: 13,
        options: [{label:'Walk-in',value:'walk_in'},{label:'OTA',value:'ota'},{label:'Phone',value:'phone'},{label:'Website',value:'website'},{label:'Agent',value:'agent'}]},
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true,  sort_order: 14,
        options: [{label:'Reserved',value:'reserved'},{label:'Checked In',value:'checked_in'},{label:'Checked Out',value:'checked_out'},{label:'Cancelled',value:'cancelled'},{label:'No Show',value:'no_show'}]},
      { name: 'discount',      label: 'Discount Amount', field_type: 'currency', sort_order: 15 },
      { name: 'discounted_amount', label: 'Amount After Discount', field_type: 'currency', sort_order: 16 },
      { name: 'special_requests', label: 'Special Requests', field_type: 'textarea', sort_order: 17 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 18 },
    ],
    menu: [
      { name: 'item_name',     label: 'Item Name',       field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'category',      label: 'Category',        field_type: 'dropdown', is_required: true,  sort_order: 2,
        options: [{label:'Breakfast',value:'breakfast'},{label:'Lunch',value:'lunch'},{label:'Dinner',value:'dinner'},{label:'Beverages',value:'beverages'},{label:'Snacks',value:'snacks'},{label:'Desserts',value:'desserts'},{label:'Room Service',value:'room_service'}]},
      { name: 'price',         label: 'Price',           field_type: 'currency', is_required: true,  sort_order: 3 },
      { name: 'description',   label: 'Description',     field_type: 'textarea', sort_order: 4 },
      { name: 'is_veg',        label: 'Veg / Non-Veg',   field_type: 'dropdown', sort_order: 5,
        options: [{label:'Veg',value:'veg'},{label:'Non-Veg',value:'non_veg'},{label:'Vegan',value:'vegan'},{label:'Egg',value:'egg'}]},
      { name: 'available',     label: 'Availability',    field_type: 'dropdown', sort_order: 6,
        options: [{label:'Available',value:'available'},{label:'Unavailable',value:'unavailable'},{label:'Seasonal',value:'seasonal'}]},
      { name: 'tax_percent',   label: 'Tax (%)',         field_type: 'number',   sort_order: 7 },
      { name: 'linked_booking',label: 'Linked Booking',  field_type: 'text',     sort_order: 8 },
      { name: 'bill_type',     label: 'Bill Type',       field_type: 'dropdown', sort_order: 9,
        options: [{label:'Add to Room Bill',value:'room_bill'},{label:'Separate Bill',value:'separate'}]},
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 10 },
    ],
    inventory: [
      { name: 'item_name',     label: 'Item Name',       field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'category',      label: 'Category',        field_type: 'dropdown', sort_order: 2,
        options: [{label:'Kitchen',value:'kitchen'},{label:'Housekeeping',value:'housekeeping'},{label:'Bar',value:'bar'},{label:'Maintenance',value:'maintenance'},{label:'Linen',value:'linen'}]},
      { name: 'quantity',      label: 'Quantity In Stock', field_type: 'number', is_required: true,  sort_order: 3 },
      { name: 'unit',          label: 'Unit',            field_type: 'dropdown', sort_order: 4,
        options: [{label:'Pcs',value:'pcs'},{label:'Kg',value:'kg'},{label:'Ltr',value:'ltr'},{label:'Box',value:'box'},{label:'Packet',value:'packet'}]},
      { name: 'reorder_level', label: 'Reorder Level',   field_type: 'number',   sort_order: 5 },
      { name: 'unit_cost',     label: 'Unit Cost',       field_type: 'currency', sort_order: 6 },
      { name: 'supplier',      label: 'Supplier',        field_type: 'text',     sort_order: 7 },
      { name: 'last_restocked',label: 'Last Restocked',  field_type: 'date',     sort_order: 8 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 9 },
    ],
    housekeeping: [
      { name: 'room_number',   label: 'Room Number',     field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'task_type',     label: 'Task Type',       field_type: 'dropdown', is_required: true,  sort_order: 2,
        options: [{label:'Daily Cleaning',value:'daily_cleaning'},{label:'Deep Cleaning',value:'deep_cleaning'},{label:'Turndown Service',value:'turndown'},{label:'Linen Change',value:'linen_change'},{label:'Maintenance Check',value:'maintenance_check'}]},
      { name: 'assigned_to',   label: 'Assigned To',     field_type: 'text',     sort_order: 3 },
      { name: 'scheduled_date',label: 'Scheduled Date',  field_type: 'date',     sort_order: 4 },
      { name: 'scheduled_time',label: 'Scheduled Time',  field_type: 'text',     sort_order: 5 },
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true,  sort_order: 6,
        options: [{label:'Pending',value:'pending'},{label:'In Progress',value:'in_progress'},{label:'Complete',value:'complete'},{label:'Skipped',value:'skipped'}]},
      { name: 'linked_booking',label: 'Linked Booking',  field_type: 'text',     sort_order: 7 },
      { name: 'notes',         label: 'Notes',           field_type: 'textarea', sort_order: 8 },
    ],
    transport: [
      { name: 'guest_name',    label: 'Guest Name',      field_type: 'text',     is_required: true,  sort_order: 1 },
      { name: 'phone',         label: 'Phone',           field_type: 'phone',    sort_order: 2 },
      { name: 'transport_type',label: 'Transport Type',  field_type: 'dropdown', is_required: true,  sort_order: 3,
        options: [{label:'Airport Pickup',value:'airport_pickup'},{label:'Airport Drop',value:'airport_drop'},{label:'Railway Pickup',value:'railway_pickup'},{label:'Railway Drop',value:'railway_drop'},{label:'Local Transfer',value:'local_transfer'},{label:'Sightseeing',value:'sightseeing'}]},
      { name: 'pickup_location',label: 'Pickup Location', field_type: 'text',    sort_order: 4 },
      { name: 'drop_location', label: 'Drop Location',   field_type: 'text',     sort_order: 5 },
      { name: 'terminal_gate', label: 'Terminal / Gate / Platform', field_type: 'text', sort_order: 6 },
      { name: 'flight_train_no',label: 'Flight / Train No.', field_type: 'text', sort_order: 7 },
      { name: 'pickup_datetime',label: 'Pickup Date & Time', field_type: 'datetime', sort_order: 8 },
      { name: 'vehicle_type',  label: 'Vehicle Type',    field_type: 'dropdown', sort_order: 9,
        options: [{label:'Sedan',value:'sedan'},{label:'SUV',value:'suv'},{label:'Van',value:'van'},{label:'Bus',value:'bus'},{label:'Auto',value:'auto'}]},
      { name: 'driver_name',   label: 'Driver Name',     field_type: 'text',     sort_order: 10 },
      { name: 'driver_phone',  label: 'Driver Phone',    field_type: 'phone',    sort_order: 11 },
      { name: 'vehicle_number',label: 'Vehicle Number',  field_type: 'text',     sort_order: 12 },
      { name: 'fare',          label: 'Fare',            field_type: 'currency', sort_order: 13 },
      { name: 'bill_type',     label: 'Bill Type',       field_type: 'dropdown', sort_order: 14,
        options: [{label:'Add to Room Bill',value:'room_bill'},{label:'Separate Bill',value:'separate'}]},
      { name: 'status',        label: 'Status',          field_type: 'dropdown', is_required: true,  sort_order: 15,
        options: [{label:'Scheduled',value:'scheduled'},{label:'En Route',value:'en_route'},{label:'Complete',value:'complete'},{label:'Cancelled',value:'cancelled'}]},
      { name: 'linked_booking',label: 'Linked Booking',  field_type: 'text',     sort_order: 16 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 17 },
    ],
    billing: [
      { name: 'invoice_number', label: 'Invoice Number', field_type: 'text',     sort_order: 1 },
      { name: 'guest_name',    label: 'Guest Name',      field_type: 'text',     is_required: true,  sort_order: 2 },
      { name: 'linked_booking',label: 'Linked Booking',  field_type: 'text',     sort_order: 3 },
      { name: 'bill_type',     label: 'Bill Type',       field_type: 'dropdown', is_required: true,  sort_order: 4,
        options: [{label:'Room Bill',value:'room_bill'},{label:'Food Bill',value:'food_bill'},{label:'Transport Bill',value:'transport_bill'},{label:'Combined Bill',value:'combined'}]},
      { name: 'amount',        label: 'Amount',          field_type: 'currency', is_required: true,  sort_order: 5 },
      { name: 'tax',           label: 'Tax (%)',         field_type: 'number',   sort_order: 6 },
      { name: 'total',         label: 'Total Amount',    field_type: 'currency', sort_order: 7 },
      { name: 'payment_status',label: 'Payment Status',  field_type: 'dropdown', is_required: true,  sort_order: 8,
        options: [{label:'Unpaid',value:'unpaid'},{label:'Partial',value:'partial'},{label:'Paid',value:'paid'},{label:'Overdue',value:'overdue'}]},
      { name: 'payment_method',label: 'Payment Method',  field_type: 'dropdown', sort_order: 9,
        options: [{label:'Cash',value:'cash'},{label:'Card',value:'card'},{label:'UPI',value:'upi'},{label:'Bank Transfer',value:'bank'},{label:'OTA Collected',value:'ota'}]},
      { name: 'payment_date',  label: 'Payment Date',    field_type: 'date',     sort_order: 10 },
      { name: 'remarks',       label: 'Remarks',         field_type: 'textarea', sort_order: 11 },
    ],
    reports: [
      { name: 'report_type',   label: 'Report Type',     field_type: 'dropdown', is_required: true,  sort_order: 1,
        options: [{label:'Occupancy Report',value:'occupancy'},{label:'Revenue Report',value:'revenue'},{label:'Booking Summary',value:'booking_summary'},{label:'Food & Beverage',value:'fnb'},{label:'Transport Summary',value:'transport_summary'},{label:'Housekeeping Log',value:'housekeeping_log'}]},
      { name: 'period_from',   label: 'Period From',     field_type: 'date',     is_required: true,  sort_order: 2 },
      { name: 'period_to',     label: 'Period To',       field_type: 'date',     is_required: true,  sort_order: 3 },
      { name: 'total_value',   label: 'Total Value',     field_type: 'currency', sort_order: 4 },
      { name: 'record_count',  label: 'Record Count',    field_type: 'number',   sort_order: 5 },
      { name: 'notes',         label: 'Notes',           field_type: 'textarea', sort_order: 6 },
    ],
  },
};
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding...\n');

    // 1. Industries
    console.log('  → Industries...');
    const industryIds = {};
    for (const ind of INDUSTRIES) {
      const r = await client.query(
        `INSERT INTO industries (name, slug, description) VALUES ($1,$2,$3)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [ind.name, ind.slug, ind.description]
      );
      industryIds[ind.slug] = r.rows[0].id;
    }
    console.log('  ✓ Industries done');

    // 2. Modules
    console.log('  → Modules...');
    const moduleIds = {};
    for (const mod of MODULES) {
      const r = await client.query(
        `INSERT INTO modules (name, slug, icon, sort_order) VALUES ($1,$2,$3,$4)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [mod.name, mod.slug, mod.icon, mod.sort_order]
      );
      moduleIds[mod.slug] = r.rows[0].id;
    }
    console.log('  ✓ Modules done');

    // 3. Industry → Module links
    console.log('  → Industry module chains...');
    for (const [indSlug, modSlugs] of Object.entries(INDUSTRY_MODULES)) {
      for (let i = 0; i < modSlugs.length; i++) {
        await client.query(
          `INSERT INTO industry_modules (industry_id, module_id, sort_order)
           VALUES ($1,$2,$3) ON CONFLICT (industry_id, module_id) DO NOTHING`,
          [industryIds[indSlug], moduleIds[modSlugs[i]], i]
        );
      }
    }
    console.log('  ✓ Industry chains done');

    // 4. Title Heads
    console.log('  → Title heads...');
    let fieldCount = 0;
    for (const [indSlug, modules] of Object.entries(TITLE_HEADS)) {
      for (const [modSlug, fields] of Object.entries(modules)) {
        for (const f of fields) {
          await client.query(
            `INSERT INTO title_heads
               (industry_id, module_id, name, label, field_type, options, is_required, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (industry_id, module_id, name) DO UPDATE SET
               label=EXCLUDED.label, field_type=EXCLUDED.field_type,
               options=EXCLUDED.options, is_required=EXCLUDED.is_required`,
            [
              industryIds[indSlug], moduleIds[modSlug],
              f.name, f.label, f.field_type,
              f.options ? JSON.stringify(f.options) : null,
              f.is_required || false, f.sort_order,
            ]
          );
          fieldCount++;
        }
      }
    }
    console.log(`  ✓ ${fieldCount} title heads seeded`);

    // 5. Super Admin
    const superEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@drusshti.com';
    const superPass  = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const superHash  = await bcrypt.hash(superPass, 12);
    const saExists   = await client.query(`SELECT id FROM users WHERE email=$1 AND tenant_id IS NULL AND role='super_admin'`, [superEmail]);
    if (!saExists.rows[0]) {
      await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
         VALUES (NULL,$1,$2,'Super','Admin','super_admin')`,
        [superEmail, superHash]
      );
      console.log(`\n  ✓ Super Admin: ${superEmail} / ${superPass}`);
    }

    // 6. Demo Client Servicing user
    const csEmail = 'cs@drusshti.com';
    const csPass  = 'CS@123456';
    const csHash  = await bcrypt.hash(csPass, 12);
    const csExists = await client.query(`SELECT id FROM users WHERE email=$1 AND tenant_id IS NULL`, [csEmail]);
    if (!csExists.rows[0]) {
      await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role)
         VALUES (NULL,$1,$2,'Client','Servicing','client_servicing')`,
        [csEmail, csHash]
      );
      console.log(`  ✓ Client Servicing: ${csEmail} / ${csPass}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!\n');
    console.log('─────────────────────────────────────────────');
    console.log('  Super Admin       : superadmin@drusshti.com / SuperAdmin@123');
    console.log('  Client Servicing  : cs@drusshti.com / CS@123456');
    console.log('─────────────────────────────────────────────\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

seed().catch(console.error);
