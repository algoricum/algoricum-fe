#!/bin/bash

# Find unused React components and files in src directory
# This script should be placed in src/scripts/ and will scan the entire src directory

# Navigate to src directory (parent of scripts)
cd "$(dirname "$0")/.."

echo "🔍 Finding unused files in src directory..."
echo "📍 Scanning from: $(pwd)"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for unused files
unused_count=0

# Create temporary file to store all imports
temp_imports=$(mktemp)

# Extract all import statements from all JS/JSX/TS/TSX files
find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | while read file; do
  # Skip node_modules and build directories
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"build"* ]] || [[ "$file" == *"dist"* ]]; then
    continue
  fi

  # Extract import statements and normalize paths
  grep -E "^import.*from ['\"]" "$file" 2>/dev/null |
    sed -E "s/.*from ['\"]([^'\"]*)['\"].*/\1/" |
    while read import_path; do
      # Convert relative imports to absolute paths
      if [[ "$import_path" == ./* ]] || [[ "$import_path" == ../* ]]; then
        # Resolve relative path
        dir=$(dirname "$file")
        resolved_path=$(cd "$dir" && realpath --relative-to=. "$import_path" 2>/dev/null)
        if [[ -n "$resolved_path" ]]; then
          echo "$resolved_path" >>"$temp_imports"
        fi
      elif [[ "$import_path" != @* ]] && [[ "$import_path" != */* ]] || [[ "$import_path" == ./* ]]; then
        # Handle local imports
        echo "$import_path" >>"$temp_imports"
      fi
    done
done

# Also check for dynamic imports
find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | while read file; do
  if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"build"* ]] || [[ "$file" == *"dist"* ]]; then
    continue
  fi

  # Check for dynamic imports like import() or require()
  grep -E "(import\(|require\()['\"]" "$file" 2>/dev/null |
    sed -E "s/.*(import\(|require\()['\"]([^'\"]*)['\"].*/\2/" >>"$temp_imports"
done

# Find all React component files (excluding App.tsx/App.js)
echo -e "${YELLOW}Checking for unused files...${NC}"
echo ""

find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" | while read file; do
  # Skip certain files and directories
  if [[ "$file" == *"node_modules"* ]] ||
    [[ "$file" == *"build"* ]] ||
    [[ "$file" == *"dist"* ]] ||
    [[ "$file" == *"test"* ]] ||
    [[ "$file" == *"spec"* ]] ||
    [[ "$file" == "./App.tsx" ]] ||
    [[ "$file" == "./App.js" ]] ||
    [[ "$file" == "./index.js" ]] ||
    [[ "$file" == "./index.tsx" ]] ||
    [[ "$file" == "./reportWebVitals.js" ]] ||
    [[ "$file" == "./setupTests.js" ]]; then
    continue
  fi

  # Get filename without extension and path
  filename=$(basename "$file")
  filename_no_ext="${filename%.*}"
  relative_path="${file#./}"
  relative_path_no_ext="${relative_path%.*}"

  # Check if file is imported anywhere
  is_imported=false

  # Check various import patterns
  if grep -q "$relative_path" "$temp_imports" 2>/dev/null ||
    grep -q "$relative_path_no_ext" "$temp_imports" 2>/dev/null ||
    grep -q "$filename_no_ext" "$temp_imports" 2>/dev/null ||
    grep -q "$filename" "$temp_imports" 2>/dev/null; then
    is_imported=true
  fi

  # Also check if the file is referenced in any other way
  if ! $is_imported; then
    # Search for the filename (without extension) in all files
    if find . -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" |
      xargs grep -l "/$filename_no_ext\"" 2>/dev/null |
      grep -v "$file" >/dev/null; then
      is_imported=true
    fi
  fi

  if ! $is_imported; then
    echo -e "${RED}❌ UNUSED: $file${NC}"
    ((unused_count++))
  else
    echo -e "${GREEN}✅ USED: $file${NC}"
  fi
done

# Clean up
rm -f "$temp_imports"

echo ""
echo "================================================"
if [ $unused_count -eq 0 ]; then
  echo -e "${GREEN}🎉 No unused files found!${NC}"
else
  echo -e "${YELLOW}📊 Found $unused_count potentially unused files${NC}"
  echo -e "${YELLOW}⚠️  Please verify manually before deleting!${NC}"
fi
echo ""

# Additional checks
echo -e "${YELLOW}💡 Additional suggestions:${NC}"
echo "   • Check if any files are used in public/index.html"
echo "   • Verify files aren't used in package.json scripts"
echo "   • Some files might be used by build tools or testing frameworks"
echo "   • Dynamic imports might not be caught by this script"
