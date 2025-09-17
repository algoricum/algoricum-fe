import { useState, useEffect, useRef } from "react";

interface DropdownPosition {
  top: number;
  left: number;
}

interface UseDropdownOptions {
  dropdownWidth?: number;
  dropdownHeight?: number;
  offset?: number;
}

export const useDropdown = (options: UseDropdownOptions = {}) => {
  const {
    dropdownWidth = 192, // w-48 in Tailwind (48 * 4px = 192px)
    dropdownHeight = 120,
    offset = 8,
  } = options;

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [activeDropdown]);

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    if (activeDropdown === id) {
      setActiveDropdown(null);
      return;
    }

    // Calculate position relative to viewport
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let top = rect.bottom + offset;
    let left = rect.right - dropdownWidth;

    // Position above if dropdown would go below viewport
    if (rect.bottom + dropdownHeight > viewportHeight) {
      top = rect.top - dropdownHeight - offset;
    }

    // Adjust horizontal position if dropdown would go off-screen
    if (left < offset) {
      left = offset;
    } else if (left + dropdownWidth > viewportWidth - offset) {
      left = viewportWidth - dropdownWidth - offset;
    }

    setDropdownPosition({ top, left });
    setActiveDropdown(id);
  };

  const closeDropdown = () => {
    setActiveDropdown(null);
  };

  const isOpen = (id: string) => activeDropdown === id;

  return {
    activeDropdown,
    dropdownPosition,
    dropdownRef,
    toggleDropdown,
    closeDropdown,
    isOpen,
  };
};
