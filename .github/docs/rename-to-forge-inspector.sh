#!/bin/bash

# Automated Renaming Script: vibe-kanban-web-companion → forge-inspector
# This script safely renames all references while preserving dependencies

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Dry run flag
DRY_RUN=${DRY_RUN:-false}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to perform file content replacement
replace_in_file() {
    local file="$1"
    local search="$2"
    local replace="$3"

    if [ "$DRY_RUN" = true ]; then
        if grep -q "$search" "$file" 2>/dev/null; then
            log_info "[DRY-RUN] Would replace '$search' → '$replace' in: $file"
        fi
    else
        if grep -q "$search" "$file" 2>/dev/null; then
            sed -i "s|$search|$replace|g" "$file"
            log_success "Replaced '$search' → '$replace' in: $file"
        fi
    fi
}

# Function to rename file or directory
rename_path() {
    local old_path="$1"
    local new_path="$2"

    if [ ! -e "$old_path" ]; then
        log_warning "Path does not exist: $old_path"
        return
    fi

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY-RUN] Would rename: $old_path → $new_path"
    else
        mv "$old_path" "$new_path"
        log_success "Renamed: $old_path → $new_path"
    fi
}

log_info "======================================"
log_info "Forge Inspector Renaming Script"
log_info "======================================"
if [ "$DRY_RUN" = true ]; then
    log_warning "DRY RUN MODE - No changes will be made"
fi
echo ""

# Step 1: Update file contents FIRST (before renaming files/directories)
log_info "Step 1: Updating file contents..."
echo ""

# Update package.json files
log_info "Updating package.json files..."
replace_in_file "packages/vibe-kanban-web-companion/package.json" "vibe-kanban-web-companion" "forge-inspector"
replace_in_file "packages/vibe-kanban-web-companion/package.json" "Vibe Kanban" "Automagik Forge"
replace_in_file "packages/vibe-kanban-web-companion/package.json" "vibekanban.com" "automagik.dev"
replace_in_file "packages/vibe-kanban-web-companion/package.json" "BloopAI/vibe-kanban-web-companion" "BloopAI/forge-inspector"

replace_in_file "apps/cra/package.json" "vibe-kanban-web-companion" "forge-inspector"
replace_in_file "apps/next/package.json" "vibe-kanban-web-companion" "forge-inspector"
replace_in_file "apps/remix/package.json" "vibe-kanban-web-companion" "forge-inspector"

# Update README.md
log_info "Updating README.md..."
replace_in_file "packages/vibe-kanban-web-companion/README.md" "Vibe Kanban Web Companion" "Forge Inspector"
replace_in_file "packages/vibe-kanban-web-companion/README.md" "Vibe Kanban" "Automagik Forge"
replace_in_file "packages/vibe-kanban-web-companion/README.md" "vibe-kanban-web-companion" "forge-inspector"
replace_in_file "packages/vibe-kanban-web-companion/README.md" "vibekanban.com" "automagik.dev"
replace_in_file "packages/vibe-kanban-web-companion/README.md" "VibeKanbanWebCompanion" "ForgeInspector"

# Update TypeScript types
log_info "Updating TypeScript types..."
replace_in_file "packages/vibe-kanban-web-companion/src/types.d.ts" "VibeKanbanWebCompanion" "ForgeInspector"
replace_in_file "packages/vibe-kanban-web-companion/src/types.d.ts" "VibeKanban" "ForgeInspector"

# Update main component file
log_info "Updating main component file..."
replace_in_file "packages/vibe-kanban-web-companion/src/VibeKanbanWebCompanion.js" "VibeKanbanWebCompanion" "ForgeInspector"
replace_in_file "packages/vibe-kanban-web-companion/src/VibeKanbanWebCompanion.js" "vkIcon" "fiIcon"
replace_in_file "packages/vibe-kanban-web-companion/src/VibeKanbanWebCompanion.js" "VK Icon" "FI Icon"

# Update index.js
log_info "Updating index.js..."
replace_in_file "packages/vibe-kanban-web-companion/src/index.js" "VibeKanbanWebCompanion" "ForgeInspector"
replace_in_file "packages/vibe-kanban-web-companion/src/index.js" "./VibeKanbanWebCompanion.js" "./ForgeInspector.js"

# Update app imports
log_info "Updating app imports..."
replace_in_file "apps/cra/src/index.js" "VibeKanbanWebCompanion" "ForgeInspector"
replace_in_file "apps/cra/src/index.js" "vibe-kanban-web-companion" "forge-inspector"

replace_in_file "apps/next/pages/_app.tsx" "VibeKanbanWebCompanion" "ForgeInspector"
replace_in_file "apps/next/pages/_app.tsx" "vibe-kanban-web-companion" "forge-inspector"

replace_in_file "apps/remix/app/root.tsx" "VibeKanbanWebCompanion" "ForgeInspector"
replace_in_file "apps/remix/app/root.tsx" "vibe-kanban-web-companion" "forge-inspector"

echo ""
log_success "File contents updated!"
echo ""

# Step 2: Rename the main component file
log_info "Step 2: Renaming component file..."
rename_path "packages/vibe-kanban-web-companion/src/VibeKanbanWebCompanion.js" "packages/vibe-kanban-web-companion/src/ForgeInspector.js"
echo ""

# Step 3: Rename the package directory
log_info "Step 3: Renaming package directory..."
rename_path "packages/vibe-kanban-web-companion" "packages/forge-inspector"
echo ""

# Step 4: Rename the root directory (needs to be done from parent)
log_info "Step 4: Renaming root directory..."
cd ..
PARENT_DIR="$(pwd)"
OLD_ROOT="vibe-kanban-web-companion"
NEW_ROOT="forge-inspector"

if [ -d "$OLD_ROOT" ]; then
    rename_path "$OLD_ROOT" "$NEW_ROOT"
    cd "$NEW_ROOT"
else
    log_warning "Root directory already renamed or script running from renamed directory"
    cd "$SCRIPT_DIR"
fi
echo ""

# Step 5: Clean and reinstall dependencies
if [ "$DRY_RUN" = false ]; then
    log_info "Step 5: Cleaning and reinstalling dependencies..."

    if [ -f "pnpm-lock.yaml" ]; then
        log_info "Removing old pnpm-lock.yaml..."
        rm -f pnpm-lock.yaml
    fi

    if [ -d "node_modules" ]; then
        log_info "Removing node_modules..."
        rm -rf node_modules
    fi

    log_info "Running pnpm install..."
    pnpm install

    log_success "Dependencies reinstalled!"
else
    log_info "[DRY-RUN] Would clean and reinstall dependencies"
fi
echo ""

# Step 6: Validation
if [ "$DRY_RUN" = false ]; then
    log_info "Step 6: Running validation..."
    echo ""

    log_info "Running TypeScript check..."
    if [ -d "packages/forge-inspector" ]; then
        cd packages/forge-inspector
        if pnpm run lint; then
            log_success "TypeScript check passed!"
        else
            log_error "TypeScript check failed!"
            exit 1
        fi
        cd ../..
    else
        log_warning "Package directory not found, skipping TypeScript check"
    fi

    log_info "Running turbo build..."
    if pnpm run build; then
        log_success "Build successful!"
    else
        log_error "Build failed!"
        exit 1
    fi
else
    log_info "[DRY-RUN] Would run validation checks"
fi

echo ""
log_info "======================================"
log_success "Renaming Complete!"
log_info "======================================"
echo ""
log_info "Summary of changes:"
echo "  • Package name: vibe-kanban-web-companion → forge-inspector"
echo "  • Component: VibeKanbanWebCompanion → ForgeInspector"
echo "  • Brand: Vibe Kanban → Automagik Forge"
echo "  • Icon variable: vkIcon → fiIcon"
echo ""
log_info "Next steps:"
echo "  1. Review the changes with: git diff"
echo "  2. Test the apps manually"
echo "  3. Update any external documentation"
echo "  4. Commit the changes"
echo ""
