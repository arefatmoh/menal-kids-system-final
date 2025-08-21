# Transaction Variations Enhancement

## Overview

This document outlines the enhancement of the transaction system to support product variations in sales and transfers. Previously, the system only tracked products at the product level in transactional tables, despite having a comprehensive product variation system implemented for inventory management.

## Changes Made

### Database Schema

A new migration file (`004_add_variation_id_to_transaction_tables.sql`) has been created to add variation support to transactional tables:

- Added `variation_id` column to `sale_items` table
- Added `variation_id` column to `transfer_items` table
- Created appropriate indexes for performance optimization
- Added foreign key constraints to ensure data integrity

### Type Definitions

The following interfaces have been updated to include optional variation_id fields:

- `SaleItem` interface
- `TransferItem` interface
- `CreateSaleData` interface
- `CreateTransferData` interface

The variation_id field is optional to maintain backward compatibility with uniform products (products without variations).

### API Routes

#### Sales API

- Updated validation schema to accept variation_id
- Modified SQL queries to include variation_id in insertions
- Enhanced inventory checks to verify stock at the variation level
- Updated inventory updates to operate at the variation level
- Modified stock movement records to track variation information
- Enhanced GET endpoint to include variation details in the response

#### Transfers API

- Updated validation schema to accept variation_id
- Modified SQL queries to include variation_id in insertions
- Enhanced inventory checks to verify stock at the variation level for both source and destination branches
- Updated inventory updates to operate at the variation level
- Modified stock movement records to track variation information
- Enhanced GET endpoint to include variation details in the response

## Benefits

- Complete end-to-end tracking of product variations throughout the system
- More accurate inventory management at the variation level
- Better reporting capabilities with variation-specific sales and transfer data
- Improved user experience with detailed variation information in transaction records

## Implementation Notes

- All changes maintain backward compatibility with existing uniform products
- The variation_id field is optional in all interfaces and database columns
- Inventory checks and updates now consider both product_id and variation_id
- Stock movements now track variation-specific information

## Future Considerations

- Update dashboard statistics to include variation-level metrics
- Enhance reporting views to provide variation-specific insights
- Consider adding variation-specific pricing rules
- Implement variation-specific alerts for low stock levels