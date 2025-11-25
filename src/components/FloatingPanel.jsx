import React, { useState, useRef, useEffect } from 'react';
import { Box, Heading, IconButton } from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';

/**
 * FloatingPanel - A draggable and resizable floating panel component
 * @param {Object} props
 * @param {string} props.title - Panel title
 * @param {number} props.initialX - Initial X position
 * @param {number} props.initialY - Initial Y position
 * @param {number} props.initialWidth - Initial width
 * @param {number} props.initialHeight - Initial height
 * @param {number} props.zIndex - Z-index for layering
 * @param {number} props.minWidth - Minimum width
 * @param {number} props.minHeight - Minimum height
 * @param {string} props.bg - Background color (optional)
 * @param {React.ReactNode} props.children - Panel content
 */
const FloatingPanel = ({
  title,
  initialX = 100,
  initialY = 100,
  initialWidth = 400,
  initialHeight = 300,
  zIndex = 1000,
  minWidth = 200,
  minHeight = 150,
  bg = "white",
  children
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.resize-handle')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({
          x: Math.max(0, Math.min(newX, window.innerWidth - size.width)),
          y: Math.max(0, Math.min(newY, window.innerHeight - size.height))
        });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setSize({
          width: Math.max(minWidth, size.width + deltaX),
          height: Math.max(minHeight, size.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, size, minWidth, minHeight]);

  return (
    <Box
      ref={panelRef}
      position="fixed"
      left={`${position.x}px`}
      top={`${position.y}px`}
      width={`${size.width}px`}
      height={`${size.height}px`}
      bg={bg}
      border="2px solid"
      borderColor="gray.300"
      borderRadius="md"
      boxShadow="xl"
      zIndex={zIndex}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Header - Draggable */}
      <Box
        bg="gray.100"
        p={2}
        borderBottom="1px solid"
        borderColor="gray.300"
        cursor={isDragging ? 'grabbing' : 'grab'}
        onMouseDown={handleMouseDown}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        userSelect="none"
      >
        <Heading size="sm" color="gray.700">
          {title}
        </Heading>
        <IconButton
          aria-label="Close panel"
          icon={<CloseIcon />}
          size="xs"
          variant="ghost"
          onClick={() => {
            // Optional: Add close handler if needed
            console.log('Close panel');
          }}
        />
      </Box>

      {/* Content */}
      <Box flex="1" overflow="auto" p={4}>
        {children}
      </Box>

      {/* Resize Handle */}
      <Box
        className="resize-handle"
        position="absolute"
        bottom={0}
        right={0}
        width="20px"
        height="20px"
        cursor="nwse-resize"
        bg="gray.400"
        opacity={0.5}
        _hover={{ opacity: 1 }}
        onMouseDown={handleResizeMouseDown}
      />
    </Box>
  );
};

export default FloatingPanel;

