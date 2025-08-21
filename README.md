# Menal Kids Shop ERP System

A comprehensive Enterprise Resource Planning (ERP) system designed specifically for kids fashion retail stores. This system manages inventory, sales, stock movements, transfers between branches, and provides real-time analytics and alerts.

## 🚀 Features

### Core Modules
- **Dashboard**: Real-time overview with statistics and recent activities
- **Products Management**: Complete product catalog with categories, SKUs, and inventory tracking
- **Sales Processing**: Point-of-sale system with multiple payment methods
- **Stock Management**: Track stock movements, low stock alerts, and inventory levels
- **Branch Management**: Multi-branch support with transfer capabilities
- **Reports & Analytics**: Sales reports, expense tracking, and performance metrics
- **Alerts System**: Real-time notifications for low stock, budget overruns, and performance issues

### Technical Features
- **Modern UI**: Built with Next.js 14, TypeScript, and Tailwind CSS
- **Real-time Data**: Live updates and notifications
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Multi-language Support**: English and Amharic localization
- **Role-based Access**: Owner and employee permissions
- **Database Integration**: PostgreSQL with advanced functions and triggers

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL
- **Authentication**: JWT tokens
- **UI Components**: Shadcn/ui
- **Charts**: Recharts
- **Icons**: Lucide React

## 📋 Prerequisites

Before setting up the project, ensure you have:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **pnpm** package manager

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd menal-kids-system-final
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Set Up Database

#### Option A: Using Deployment Script (Recommended)

Windows:
```cmd
cd database
deploy-database.bat
```

Linux/Mac:
```bash
cd database
chmod +x deploy-database.sh
./deploy-database.sh
```

#### Option B: Manual Setup (Windows/Linux/Mac)

1. **Create Database**:
   ```bash
   createdb -U postgres menal_kids_shop
   ```

2. **Apply Schema**:
   ```bash
   psql -U postgres -d menal_kids_shop -f database/deployment-schema.sql
   ```

3. **Apply Functions**:
   ```bash
   psql -U postgres -d menal_kids_shop -f database/deployment-functions.sql
   ```

For more details and verification queries, see `database/DEPLOYMENT_README.md`.

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/menal_kids_shop"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-here"

# Next.js Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"
```

### 5. Start Development Server

```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`

## 👥 Login Credentials

After setup, you can log in with these sample accounts:

### Owner Account
- **Email**: `owner@menalkids.com`
- **Password**: `owner123`
- **Access**: All branches and features

### Employee Accounts
- **Franko Branch**: `sarah@menalkids.com` / `employee123`
- **Mebrathayl Branch**: `michael@menalkids.com` / `employee123`

## 📊 Fresh Start

The system is set up for a completely fresh start:

- **2 Branches**: Franko (Main) and Mebrathayl locations
- **3 Users**: Owner, Sarah (Franko), and Michael (Mebrathayl)
- **No Categories**: Add your own product categories
- **No Products**: Add your real inventory
- **No Sample Data**: Start with your real business data

## 🏗️ Project Structure

```
menal-kids-system-final/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── *.tsx            # Custom components
├── database/             # Database files
│   ├── schema.sql        # Database schema
│   ├── functions.sql     # Database functions
│   ├── triggers.sql      # Database triggers
│   └── sample_data.sql   # Sample data
├── lib/                  # Utility libraries
│   ├── auth.ts          # Authentication utilities
│   ├── db.ts            # Database connection
│   ├── api-client.ts    # API client
│   └── types.ts         # TypeScript types
├── scripts/             # Reference-only; see scripts/README.md
└── public/              # Static assets
```

## 🔍 Inventory Search Mechanism (Developer Reference)

The inventory search feature supports three types of search logic, depending on the length of the search term:

- **Enhanced Exact Match (<3 characters):**
  - Finds exact matches and terms that start with the search string in product names, SKUs, brands, and categories.
  - Example: Searching for "dr" will match "Dress" and "Drum".

- **Partial Match (3-5 characters):**
  - Finds the search term anywhere in product names, SKUs, brands, categories, colors, and sizes.
  - Example: Searching for "ብርድ" will match any product with "ብርድ" in its name, SKU, brand, category, color, or size.

- **Phrase Match (6+ characters):**
  - Finds all words in the search term across all fields (product name, SKU, brand, category, color, size, etc.).
  - Example: Searching for "ብርድ ልብስ" will match products that contain both words in any field.

This logic is implemented in the frontend and backend, but is not shown to end users in the UI. For more details, see the `formatSearchForAPI` and `getSearchType` functions in the inventory page code.

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/activities` - Recent activities

### Products
- `GET /api/products` - List products with pagination
- `POST /api/products` - Create new product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product

### Inventory
- `GET /api/inventory` - List inventory with filters
- `PUT /api/inventory` - Update inventory levels

### Sales
- `GET /api/sales` - List sales with pagination
- `POST /api/sales` - Create new sale

### Stock Movements
- `GET /api/stock-movements` - List stock movements
- `POST /api/stock-movements` - Create stock movement

### Alerts
- `GET /api/alerts` - List alerts
- `PUT /api/alerts` - Update alert status

### Reports
- `GET /api/reports/sales` - Sales reports
- `GET /api/reports/expenses` - Expense reports

## 🎨 Customization

### Adding New Features

1. **Database**: Add new tables in `database/schema.sql`
2. **API**: Create new routes in `app/api/`
3. **Frontend**: Add new pages in `app/dashboard/`
4. **Types**: Update `lib/types.ts` with new interfaces

### Styling

The project uses Tailwind CSS with a custom color scheme:
- Primary: Pink (`#ec4899`)
- Secondary: Purple (`#a855f7`)
- Success: Green (`#22c55e`)
- Warning: Orange (`#f97316`)
- Error: Red (`#ef4444`)

## 📖 Consolidated Overview

For a concise, up-to-date summary of features, architecture, and deployment, see `PROJECT_OVERVIEW.md`.

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables for Production

```env
DATABASE_URL="postgresql://username:password@host:port/database"
JWT_SECRET="your-production-jwt-secret"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-production-nextauth-secret"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Updates

To update the system:

1. Pull the latest changes
2. Update dependencies: `npm install`
3. Run database migrations if any
4. Restart the development server

---

**Built with ❤️ for Menal Kids Shop** 