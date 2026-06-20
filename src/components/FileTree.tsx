// 文件树组件 - 展示融合产物

import { useState } from 'react'
import { ChevronRight, File, Folder, FolderOpen, Download } from 'lucide-react'
import type { FileNode } from '@/lib/types'

interface FileTreeProps {
  nodes: FileNode[]
  taskId?: string
  onSelect?: (node: FileNode) => void
  selectedPath?: string
}

export default function FileTree({ nodes, onSelect, selectedPath }: FileTreeProps) {
  return (
    <div className="text-sm">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          onSelect={onSelect}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  )
}

interface TreeNodeProps {
  node: FileNode
  depth: number
  onSelect?: (node: FileNode) => void
  selectedPath?: string
}

function FileTreeNode({ node, depth, onSelect, selectedPath }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isDir = node.type === 'dir'
  const isSelected = selectedPath === node.path

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors"
        style={{
          paddingLeft: `${depth * 16 + 8}px`,
          background: isSelected ? 'rgba(124, 92, 255, 0.12)' : 'transparent',
        }}
        onClick={() => {
          if (isDir) {
            setExpanded(!expanded)
          } else {
            onSelect?.(node)
          }
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
        }}
      >
        {isDir ? (
          <>
            <ChevronRight
              size={14}
              className="text-dim transition-transform"
              style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
            />
            {expanded ? (
              <FolderOpen size={15} className="text-aurora-cyan" />
            ) : (
              <Folder size={15} className="text-aurora-purple" />
            )}
          </>
        ) : (
          <>
            <span style={{ width: 14 }} />
            <File size={15} className="text-dim" />
          </>
        )}
        <span className={isSelected ? 'text-aurora-cyan' : ''}>
          {node.path.split('/').pop()}
        </span>
      </div>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}
