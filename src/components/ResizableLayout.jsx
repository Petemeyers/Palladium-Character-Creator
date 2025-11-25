import { useState, useRef, useEffect } from "react";
import { Box } from "@chakra-ui/react";

/**
 * ResizableLayout - A flexible layout component with resizable sidebars
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.leftSidebar - Content for left sidebar
 * @param {React.ReactNode} props.centerContent - Main content (map)
 * @param {React.ReactNode} props.rightSidebar - Content for right sidebar
 * @param {number} props.initialLeftWidth - Initial left sidebar width in px (default: 350)
 * @param {number} props.initialRightWidth - Initial right sidebar width in px (default: 350)
 * @param {number} props.minSidebarWidth - Minimum sidebar width in px (default: 200)
 * @param {number} props.maxSidebarWidth - Maximum sidebar width in px (default: 600)
 * @param {boolean} props.showLeftSidebar - Whether to show left sidebar (default: true)
 * @param {boolean} props.showRightSidebar - Whether to show right sidebar (default: true)
 */
export default function ResizableLayout({
  leftSidebar,
  centerContent,
  rightSidebar,
  initialLeftWidth = 350,
  initialRightWidth = 350,
  minSidebarWidth = 200,
  maxSidebarWidth = 600,
  showLeftSidebar = true,
  showRightSidebar = true,
}) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [rightWidth, setRightWidth] = useState(initialRightWidth);
  const containerRef = useRef(null);
  const leftDragRef = useRef(false);
  const rightDragRef = useRef(false);

  useEffect(() => {
    function handleMouseMove(e) {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerWidth = rect.width;

      // Handle left sidebar resize
      if (leftDragRef.current && showLeftSidebar) {
        const newWidth = Math.min(
          maxSidebarWidth,
          Math.max(minSidebarWidth, e.clientX - rect.left)
        );
        setLeftWidth(newWidth);
      }

      // Handle right sidebar resize
      if (rightDragRef.current && showRightSidebar) {
        const newWidth = Math.min(
          maxSidebarWidth,
          Math.max(minSidebarWidth, rect.right - e.clientX)
        );
        setRightWidth(newWidth);
      }
    }

    function handleMouseUp() {
      leftDragRef.current = false;
      rightDragRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [minSidebarWidth, maxSidebarWidth, showLeftSidebar, showRightSidebar]);

  const startLeftDrag = (e) => {
    e.preventDefault();
    leftDragRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const startRightDrag = (e) => {
    e.preventDefault();
    rightDragRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <Box
      ref={containerRef}
      display="flex"
      width="100%"
      height="100%"
      overflow="hidden"
      position="relative"
    >
      {/* Left Sidebar */}
      {showLeftSidebar && (
        <>
          <Box
            width={`${leftWidth}px`}
            flexShrink={0}
            borderRight="1px solid"
            borderColor="gray.300"
            bg="white"
            overflowY="auto"
            overflowX="hidden"
          >
            {leftSidebar}
          </Box>

          {/* Left Drag Handle */}
          <Box
            onMouseDown={startLeftDrag}
            width="6px"
            flexShrink={0}
            cursor="col-resize"
            bg="transparent"
            _hover={{
              bg: "rgba(0, 0, 0, 0.1)",
            }}
            position="relative"
            zIndex={10}
            transition="background 0.2s"
          >
            <Box
              position="absolute"
              left="50%"
              top="0"
              bottom="0"
              width="2px"
              bg="gray.400"
              transform="translateX(-50%)"
              _hover={{
                bg: "blue.500",
                width: "3px",
              }}
            />
          </Box>
        </>
      )}

      {/* Center Content (Map) */}
      <Box flex="1 1 auto" position="relative" overflow="hidden" minWidth={0}>
        {centerContent}
      </Box>

      {/* Right Drag Handle */}
      {showRightSidebar && (
        <>
          <Box
            onMouseDown={startRightDrag}
            width="6px"
            flexShrink={0}
            cursor="col-resize"
            bg="transparent"
            _hover={{
              bg: "rgba(0, 0, 0, 0.1)",
            }}
            position="relative"
            zIndex={10}
            transition="background 0.2s"
          >
            <Box
              position="absolute"
              left="50%"
              top="0"
              bottom="0"
              width="2px"
              bg="gray.400"
              transform="translateX(-50%)"
              _hover={{
                bg: "blue.500",
                width: "3px",
              }}
            />
          </Box>

          {/* Right Sidebar */}
          <Box
            width={`${rightWidth}px`}
            flexShrink={0}
            borderLeft="1px solid"
            borderColor="gray.300"
            bg="white"
            overflowY="auto"
            overflowX="hidden"
          >
            {rightSidebar}
          </Box>
        </>
      )}
    </Box>
  );
}

